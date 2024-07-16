# Aircraft Tracking Simulation

This project simulates aircraft tracking with a host aircraft and multiple other aircraft.

## Prerequisites

- Node.js (v14+)
- Docker
- Angular CLI

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   cd web-app && npm install
   ```

## Running the Application

1. Start the backend services:

   ```
   cd docker
   docker-compose up -d
   ```

2. Start the Angular app:

   ```
   cd web-app
   ng serve
   ```

3. Open http://localhost:4200 in your browser

## Project Structure

- `docker/`: Contains backend services
- `web-app/`: Angular frontend application
- `shared/`: Shared TypeScript types

## Development

- Backend services: Edit files in `docker/` directories
- Frontend: Modify Angular components in `web-app/src/app/`

## Stopping the Application

1. Stop the Angular app: Ctrl+C in the terminal running `ng serve`
2. Stop backend services:
   ```
   cd docker
   docker-compose down
   ```
