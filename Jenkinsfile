pipeline {
  agent none
  options {
    timestamps()
    ansiColor('xterm')
  }

  environment {
    PROJECT_ID = '<TU_PROJECT_ID>'              // ej: my-gcp-project
    REGION     = '<TU_REGION>'                  // ej: us-central1
    REPO       = 'lab25'                        // Artifact Registry repo
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
          // Monta el config local de gcloud si lo usas; no es obligatorio
          args '-v $HOME/.config/gcloud:/root/.config/gcloud'
        }
      }
      steps {
        withCredentials([file(credentialsId: 'gcp-sa-key', variable: 'GC_KEY')]) {
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
        withCredentials([file(credentialsId: 'gcp-sa-key', variable: 'GC_KEY')]) {
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

            # Smoke check rápido
            docker run --rm curlimages/curl:8.9.1 -fsS $(cat cr_url.txt)/ > /dev/null
            echo "Smoke check OK"
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
          // Montamos tests/ y carpeta de salida del workspace
          args '-v $WORKSPACE/tests:/tests:ro -v $WORKSPACE/k6:/out'
        }
      }
      steps {
        sh '''
          set -e
          URL=$(cat cr_url.txt)
          echo "TARGET=$URL"
          mkdir -p /out
          k6 run /tests/load-test.js --summary-export=/out/summary.json | tee /out/out.txt
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
