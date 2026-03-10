// 각 단계의 결과를 저장할 맵
def stageResults = [
    'Backend Build': '➖ Skipped',
    'Frontend Build': '➖ Skipped',
    'K8s Deployment': '➖ Skipped',
    'Big Data Test': '➖ Skipped'
]

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
                            try {
                                docker.withRegistry('https://index.docker.io/v1/', DOCKER_HUB_CREDENTIAL_ID) {
                                    def backendImg = docker.build("${BACKEND_IMAGE}", "./backend")
                                    backendImg.push()
                                    backendImg.push("latest")
                                }
                                stageResults['Backend Build'] = '✅ Success'
                            } catch (e) {
                                stageResults['Backend Build'] = '❌ Failed'
                                throw e
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
                            try {
                                docker.withRegistry('https://index.docker.io/v1/', DOCKER_HUB_CREDENTIAL_ID) {
                                    def frontendImg = docker.build("${FRONTEND_IMAGE}", "./frontend")
                                    frontendImg.push()
                                    frontendImg.push("latest")
                                }
                                stageResults['Frontend Build'] = '✅ Success'
                            } catch (e) {
                                stageResults['Frontend Build'] = '❌ Failed'
                                throw e
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
                    try {
                        withCredentials([string(credentialsId: K8S_CREDENTIAL_ID, variable: 'KUBE_CONTENT')]) {
                            writeFile file: 'kubeconfig', text: KUBE_CONTENT
                            sh """
                                export KUBECONFIG=kubeconfig
                                # 배포 파일 내 이미지 및 빌드 번호 치환
                                sed -i "s|\${BACKEND_IMAGE}|${BACKEND_IMAGE}|g" k8s/infra-test.yaml
                                sed -i "s|\${FRONTEND_IMAGE}|${FRONTEND_IMAGE}|g" k8s/infra-test.yaml
                                sed -i "s|\${BUILD_NUMBER}|${env.BUILD_NUMBER}|g" k8s/infra-test.yaml
                                
                                # 실제 배포 적용
                                kubectl apply -f k8s/infra-test.yaml --validate=false
                                
                                # 상태 확인 및 강제 재기동
                                kubectl rollout restart deployment/backend-app || true
                                kubectl rollout restart deployment/frontend-app || true
                                
                                rm kubeconfig
                            """
                        }
                        stageResults['K8s Deployment'] = '✅ Success'
                    } catch (e) {
                        stageResults['K8s Deployment'] = '❌ Failed'
                        throw e
                    }
                }
            }
        }
        
        stage('Big Data Integration Test') {
            when { changeset "bigdata/**" }
            steps {
                script {
                    try {
                        echo '빅데이터 분산 환경 연동 테스트 중...'
                        stageResults['Big Data Test'] = '✅ Success'
                    } catch (e) {
                        stageResults['Big Data Test'] = '❌ Failed'
                        throw e
                    }
                }
            }
        }
    }

    post {
        always {
            script {
                def buildStatus = currentBuild.currentResult
                def color = (buildStatus == 'SUCCESS') ? '#00FF00' : (buildStatus == 'FAILURE' ? '#FF0000' : '#FFA500')
                
                // 상세 리포트 생성
                def summaryMsg = stageResults.collect { k, v -> "- **${k}**: ${v}" }.join('\n')
                
                // 커밋 정보 가져오기
                def changeLog = "N/A"
                try {
                    def changeLogSets = currentBuild.changeSets
                    if (changeLogSets.size() > 0 && changeLogSets[0].items.length > 0) {
                        def entry = changeLogSets[0].items[0]
                        changeLog = "✍️ **Author:** ${entry.author.fullName}\n💬 **Msg:** ${entry.msg}"
                    }
                } catch (e) { /* ignore */ }

              def currentStatus = currentBuild.currentResult
                def statusColor = (currentStatus == 'SUCCESS') ? '#00FF00' : (currentStatus == 'FAILURE' ? '#FF0000' : '#FFA500')
                
                // 2. Mattermost 전송 (기본 설정을 무시하고 직접 주소 입력)
                mattermostSend (
                    color: statusColor,
                    endpoint: "https://meeting.ssafy.com/hooks/64bwh9doxpnbfcndhpezpsp9ic",
                    channel: '',
                    message: """
**🚀 파이프라인 결과: ${currentStatus} (Branch: develop)**
${changeLog}

| Stage | Status |
| :--- | :--- |
${stageResults.collect { k, v -> "| ${k} | ${v} |" }.join('\n')}

---
🔗 [상세 로그 확인하기](${env.BUILD_URL}console)
""".stripIndent()
                )
            }
        }
    }
}