# lro-website
Brief description
A lightweight visual-framework website that provides reusable design components and a simple static HTML page. Packaged with Docker and deployable to Kubernetes. Local development via Docker Compose exposes the site on port 8082.

Key features
- Visual design system / component library (reusable UI components)
- Static HTML entry (build/index.html)
- Dockerized application with a Dockerfile
- docker-compose for local development (serves on localhost:8082)
- Kubernetes manifests for cluster deployment (k8s/)

Prerequisites
- Docker
- Docker Compose (v1.27+ or v2)
- kubectl
- (Optional) kind or minikube for local k8s testing

### Quickstart — Local (Docker Compose)
1. Build and run:
  docker-compose up
2. Open: http://localhost:8080/web-optimisation-framework/
3. Stop:
  docker-compose down

### Local build using gulp
#### `gulp dev`

- Build the assets, CSS and JS for VF components and watch for changes
- Run React in development mode

#### `gulp build`

- Build the assets, CSS and JS for VF components
- Run React in build mode (yarn start)


Kubernetes deployment (basic)
- Build and push image to a registry (or load into kind/minikube):
  docker build -t <registry>/lro-website:latest .
  docker push <registry>/lro-website:latest
- Apply manifests:
  kubectl apply -f k8s/

Project layout (typical)
- Dockerfile
- docker-compose.yml
- k8s/                # Kubernetes manifests (deployments, services, ingress)
- public/index.html   # Static HTML page (entry)
- src/                # Visual framework / components
- README.md

HTML page
- public/index.html is a minimal static entry demonstrating the visual components and linking component styles/scripts. Use this as the demo landing page for the design system.

Development notes
- Component-first structure in src/ to enable isolated UI development.
- Keep Dockerfile simple (serve static files with a lightweight web server like nginx).
- For local k8s testing, prefer kind or minikube and load images directly to the cluster.

## 🌱 **Branches & CI/CD deployment**

Deployment is automated by `.gitlab-ci.yml`:

| Environment | URL                                              | Deploy trigger          |
| ----------- | ------------------------------------------------ | ----------------------- |
| Production  | [http://wwwdev.ebi.ac.uk/web-optimisation-framework](http://wwwdev.ebi.ac.uk/web-optimisation-framework) | Using Tags [YYYYMMDDHHMM] pushed on `master` |
| Development | [http://www.ebi.ac.uk/web-optimisation-framework](http://www.ebi.ac.uk/web-optimisation-framework) | All commits to `master` |

The site runs on a Kubernetes cluster under the ebiwd static set.

---
