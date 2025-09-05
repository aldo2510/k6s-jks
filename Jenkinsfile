pipeline {
  agent none

  environment {
    PROJECT_ID = 'thermal-antenna-469417-r6'              // ej: my-gcp-project
    REGION     = 'us-central1'                  // ej: us-central1
    REPO       = 'cloud-jenkins-registry'                        // Artifact Registry repo
    IMAGE      = "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/lab25-api:latest"
    SERVICE    = 'lab25-api'
  }

  stages {

    stage('Checkout') {
      agent any
      steps {
        checkout scm
      }
    }

    stage('Build Image (Cloud Build)') {
      agent {
        docker {
          image 'google/cloud-sdk:slim'
          args '-v $HOME/.config/gcloud:/root/.config/gcloud'
        }
      }
      steps {
        withCredentials([file(credentialsId: 'gcloud-creds', variable: 'GC_KEY')]) {
          sh '''
            set -e
            gcloud auth activate-service-account --key-file="${GC_KEY}"
            gcloud config set project ${PROJECT_ID}
            gcloud config set run/region ${REGION}

            # Asegura que existan las APIs y el repo (idempotente):
            gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com || true
            gcloud artifacts repositories describe ${REPO} --location=${REGION} >/dev/null 2>&1 \
              || gcloud artifacts repositories create ${REPO} --repository-format=docker --location=${REGION} --description="Lab25 images"

            # Build & push con Cloud Build (usa Dockerfile en ./app)
            cd app
            gcloud builds submit --tag ${IMAGE}
          '''
        }
      }
    }

    stage('Deploy to Cloud Run') {
      agent {
        docker {
          image 'google/cloud-sdk:slim'
          args '-v $HOME/.config/gcloud:/root/.config/gcloud'
        }
      }
      steps {
        withCredentials([file(credentialsId: 'gcloud-creds', variable: 'GC_KEY')]) {
          sh '''
            set -e
            gcloud auth activate-service-account --key-file="${GC_KEY}"
            gcloud config set project ${PROJECT_ID}
            gcloud config set run/region ${REGION}

            # Despliegue (la app escucha PORT=8080 en Cloud Run)
            gcloud run deploy ${SERVICE} \
              --image ${IMAGE} \
              --allow-unauthenticated \
              --port 8080 \
              --cpu 1 --memory 512Mi \
              --concurrency 80 \
              --min-instances 0 --max-instances 10

            # Guardar URL en workspace para el stage de k6
            gcloud run services describe ${SERVICE} --format="value(status.url)" > cr_url.txt
            echo "Cloud Run URL: $(cat cr_url.txt)"
          '''
        }
      }
      post {
        success {
          archiveArtifacts artifacts: 'cr_url.txt', fingerprint: true
        }
      }
    }

    stage('Load Test (k6)') {
      agent {
        docker {
          image 'grafana/k6:latest'
          // Necesario para que el plugin no intente ejecutar "k6 cat"
          args "--entrypoint=''"
        }
      }
      steps {
        sh '''
          set -euo pipefail
          URL=$(cat cr_url.txt)
          echo "TARGET=$URL"
    
          # Usamos el workspace que Jenkins ya montó como working dir
          mkdir -p k6
          k6 run -e TARGET="$URL" tests/load-test.js \
            --summary-export=k6/summary.json | tee k6/out.txt
        '''
      }
      post {
        always {
          archiveArtifacts artifacts: 'k6/**', fingerprint: true
        }
      }
    }


  }
}
