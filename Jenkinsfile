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
                    steps {
                        script {
                            docker.withRegistry('https://index.docker.io/v1/', DOCKER_HUB_CREDENTIAL_ID) {
                                // backend 디렉토리에서 빌드
                                def backendImg = docker.build("${BACKEND_IMAGE}", "./backend")
                                backendImg.push()
                                backendImg.push("latest")
                            }
                        }
                    }
                }
                stage('Frontend') {
                    steps {
                        script {
                            docker.withRegistry('https://index.docker.io/v1/', DOCKER_HUB_CREDENTIAL_ID) {
                                // frontend 디렉토리에서 빌드
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
            steps {
                script {
                    withCredentials([string(credentialsId: K8S_CREDENTIAL_ID, variable: 'KUBE_CONTENT')]) {
                        writeFile file: 'kubeconfig', text: KUBE_CONTENT
                        sh """
                            export KUBECONFIG=kubeconfig
                            # 배포 파일 내 이미지 태그 치환
                            sed -i 's|\${BACKEND_IMAGE}|${BACKEND_IMAGE}|g' k8s/infra-test.yaml
                            sed -i 's|\${FRONTEND_IMAGE}|${FRONTEND_IMAGE}|g' k8s/infra-test.yaml
                            
                            # 서비스 및 배포 적용
                            kubectl apply -f k8s/infra-test.yaml
                            rm kubeconfig
                        """
                    }
                }
            }
        }
        
        stage('Big Data Integration Test') {
            steps {
                echo '빅데이터 분산 환경(Spark/Hadoop) 연결 테스트 및 리소스 할당 검증...'
                // 여기에 Spark-submit 이나 Helm 설치 스크립트가 추가될 예정
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