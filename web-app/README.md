Here's the rewritten README in markdown format that you can easily copy:

# Aircraft Tracking Simulation

This project is an Angular-based web application that simulates real-time aircraft tracking using OpenLayers and WebGL. It's designed to run efficiently in Chrome on a Samsung Active tablet.

## Features

- Real-time display of host aircraft position
- Tracking of 50 other aircraft
- Smooth, efficient updates using WebGL
- Centering map on host aircraft with adjustable view modes
- Selectable aircraft with information display
- Breadcrumb trails for aircraft
- Range rings display
- Bullseye reference point setting and display

## Prerequisites

- Node.js (v14+)
- Docker
- Angular CLI
- Chrome web browser

## Project Structure

- `docker/`: Contains backend services for host and other aircraft data generation
- `web-app/`: Angular frontend application
- `shared/`: Shared TypeScript types

## Setup and Running the Application

1. Clone the repository:

   ```
   git clone <repository-url>
   cd <project-directory>
   ```

2. Install dependencies:

   ```
   npm install
   cd web-app && npm install
   ```

3. Start the backend services:

   ```
   cd docker
   docker-compose up -d
   ```

4. Start the Angular app:

   ```
   cd web-app
   ng serve
   ```

5. Open Chrome and navigate to `http://localhost:4200`

## Usage

- The map centers on the host aircraft by default
- Use the bottom-left buttons to toggle centering modes and position
- Click the breadcrumb button to cycle through trail options
- Click on other aircraft to view their information
- Use the settings menu (top-left) to set the Bullseye reference point

## Development

- Backend services: Modify files in `docker/` directories
- Frontend: Edit Angular components in `web-app/src/app/`

## Stopping the Application

1. Stop the Angular app: Ctrl+C in the terminal running `ng serve`
2. Stop backend services:
   ```
   cd docker
   docker-compose down
   ```

## Performance Considerations

- The application uses WebGL for efficient rendering
- Optimized for Chrome on Samsung Active tablet
- Implements smooth tracking updates to minimize display jumpiness

## Future Enhancements

- Display of ground-based ATC radars
- User-drawable region for filtering displayed tracks

## Troubleshooting

If you encounter any issues:

1. Ensure all prerequisites are correctly installed
2. Check that backend services are running (`docker ps`)
3. Verify the Angular app is serving without errors
4. Clear browser cache and reload the page

For further assistance, please open an issue in the project repository.
