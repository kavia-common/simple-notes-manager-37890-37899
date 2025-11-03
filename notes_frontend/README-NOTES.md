# Simple Notes App Frontend

Environment variables:
- REACT_APP_API_BASE (or REACT_APP_BACKEND_URL): Optional. If provided and reachable, the app will use it for CRUD under:
  - GET    /notes
  - POST   /notes
  - PUT    /notes/:id
  - DELETE /notes/:id

If unreachable or not provided, the app falls back to localStorage with key `notes.data.v1`.

Ports:
- The app runs on port 3000 via CRA (`npm start`).
