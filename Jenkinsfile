pipeline {
    agent any

    environment {
        DOCKER_HUB_ID = "${env.DOCKER_HUB_ID}"
        BACKEND_APP_NAME = 's14p21b109-backend'
        FRONTEND_APP_NAME = 's14p21b109-frontend'
        
        BACKEND_IMAGE = "${DOCKER_HUB_ID}/${BACKEND_APP_NAME}:${env.BUILD_NUMBER}"
        FRONTEND_IMAGE = "${DOCKER_HUB_ID}/${FRONTEND_APP_NAME}:${env.BUILD_NUMBER}"
        
        K8S_CREDENTIAL_ID = 'k8s-kubeconfig'
        DOCKER_HUB_CREDENTIAL_ID = 'docker-hub-credentials'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build & Push Images') {
            parallel {
                stage('Backend') {
                    when {
                        anyOf {
                            changeset "backend/**"
                            buildingTag()
                            triggeredBy 'UserIdCause'
                        }
                    }
                    steps {
                        script {
                            docker.withRegistry('https://index.docker.io/v1/', DOCKER_HUB_CREDENTIAL_ID) {
                                def backendImg = docker.build("${BACKEND_IMAGE}", "./backend")
                                backendImg.push()
                                backendImg.push("latest")
                            }
                        }
                    }
                }
                stage('Frontend') {
                    when {
                        anyOf {
                            changeset "frontend/**"
                            buildingTag()
                            triggeredBy 'UserIdCause'
                        }
                    }
                    steps {
                        script {
                            docker.withRegistry('https://index.docker.io/v1/', DOCKER_HUB_CREDENTIAL_ID) {
                                def frontendImg = docker.build("${FRONTEND_IMAGE}", "./frontend")
                                frontendImg.push()
                                frontendImg.push("latest")
                            }
                        }
                    }
                }
            }
        }

        stage('K8s Infrastructure Deployment') {
            when {
                anyOf {
                    changeset "backend/**"
                    changeset "frontend/**"
                    changeset "k8s/**"
                    buildingTag()
                    triggeredBy 'UserIdCause'
                }
            }
            steps {
                script {
                    withCredentials([string(credentialsId: K8S_CREDENTIAL_ID, variable: 'KUBE_CONTENT')]) {
                        writeFile file: 'kubeconfig', text: KUBE_CONTENT
                        sh """
                            export KUBECONFIG=kubeconfig
                            # 배포 파일 내 이미지 태그 치환 (변경된 이미지만 반영되도록 sed 처리)
                            # 빌드되지 않은 이미지는 기존 배포의 'latest'나 이전 버전을 유지하도록 논리를 짤 수 있으나,
                            # 여기서는 새 빌드 번호로 태깅된 이미지가 push 되었을 때만 정상 작동함.
                            sed -i 's|\${BACKEND_IMAGE}|${BACKEND_IMAGE}|g' k8s/infra-test.yaml
                            sed -i 's|\${FRONTEND_IMAGE}|${FRONTEND_IMAGE}|g' k8s/infra-test.yaml
                            
                            kubectl apply -f k8s/infra-test.yaml --validate=false
                            rm kubeconfig
                        """
                    }
                }
            }
        }
        
        stage('Big Data Integration Test') {
            when { changeset "bigdata/**" }
            steps {
                echo '빅데이터 분산 환경(Spark/Hadoop) 연결 테스트 및 리소스 할당 검증...'
            }
        }
    }

    post {
        always {
            script {
                def buildStatus = currentBuild.currentResult
                def color = (buildStatus == 'SUCCESS') ? '#00FF00' : '#FF0000'
                
                mattermostSend (
                    color: color,
                    channel: 'jetkins',
                    message: """
                        ### 🚀 인프라 구축 테스트 알림: ${buildStatus}
                        - **Backend:** `${BACKEND_IMAGE}`
                        - **Frontend:** `${FRONTEND_IMAGE}`
                        - **대상:** Spring + React + Big Data Infra
                        - **결과:** [Jenkins Log](${env.BUILD_URL})
                    """.stripIndent()
                )
            }
        }
    }
}