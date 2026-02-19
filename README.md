# Harmony AI Apps Frontend
![Harmony Link](src/assets/images/harmony-link-icon-256.png)

---

**Unified Frontend for Harmony AI Applications (Harmony Link and Harmony Speech Engine)**

This React-based web interface serves as the unified UI for both **Harmony Link** and **Harmony Speech Engine**. It provides an intuitive and comprehensive dashboard for managing AI characters, integrations, system configurations, and voice management.

The interface is optimized for real-time interaction and provides seamless access to all Harmony Link and Harmony Speech Engine features.

## Multi-Mode Architecture

This frontend can operate in two distinct modes:

### Harmony Link Mode (Default)
- AI orchestration dashboard for managing Harmony Link AI Orchestrator
- Multi-tab interface (General Settings, Entity Settings, Integrations, Simulator, Development tools)
- Comprehensive AI entity & module configuration
- Integration management and Docker control
- Real-time monitoring and event tracking
- Entity Simulator & Development Tools

### Harmony Speech Engine Mode
- Simplified 3-tab interface focused on speech processing
- Text-to-Speech (TTS) configuration and testing
- Speech-to-Text (STT) configuration
- Voice Activity Detection (VAD) configuration
- localStorage-based configuration storage
- Lightweight footprint optimized for speech engine operations

## Features

- **AI Module Configuration**: Configure Backend, TTS, STT, Movement, and Cognition modules
- **Integration Management**: Discover, configure, and control external AI services via Docker
- **Real-time Monitoring**: Live system status and event monitoring
- **Development Tools**: Built-in simulator and testing interfaces
- **Entity Management**: Configure and manage AI character entities
- **Voice Profiles**: Manage TTS and STT configurations
- **Docker Integration**: Visual interface for managing containerized AI services

## Technology Stack

- **React 18**: Modern React with hooks and functional components
- **Vite**: Fast build tool and development server
- **Tailwind CSS**: Utility-first CSS framework
- **Monaco Editor**: Integrated code editor for configuration files
- **Plotly.js**: Interactive charts and visualizations
- **Harmony Speech**: Integration with Harmony AI's speech services

## Development Setup

### Prerequisites

- Node.js 16+ and npm
- For Harmony Link mode: Harmony Link backend running
- For Speech Engine mode: Harmony Speech Engine backend running

### Installation

```bash
# Clone the repository
git clone https://github.com/harmony-ai-solutions/harmony-link-ui.git
cd harmony-link-ui

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env
```

### Using from Harmony Speech Engine Repository

If you are working from the `harmony-speech-engine` repository and `frontend/` is not present yet, clone the unified frontend into `frontend/` first:

```bash
# Clone the repository
git clone https://github.com/harmony-ai-solutions/harmony-link-ui.git frontend
cd frontend

# Install dependencies
npm install

# Copy environment configuration
cp .env.speech-engine .env

# Start in Harmony Speech Engine mode
npm run dev:speech-engine
```

For local HSE development, always use **Speech Engine mode**.

### Running in Different Modes

#### Harmony Link Mode (Default)
```bash
# Start development server
npm run dev

# Build for production
npm run build
```

#### Harmony Speech Engine Mode
```bash
# Start development server
npm run dev:speech-engine

# Build for production
npm run build:speech-engine
```

### Environment Configuration

The frontend uses environment variables to configure the API endpoints and application mode.

**Default .env (Harmony Link Mode)**:
```bash
# Default mode is Harmony Link (VITE_APP_MODE not required)
VITE_MGMT_API_URL="http://localhost"
VITE_MGMT_API_PORT="28081"
VITE_MGMT_API_PATH="/api"
VITE_MGMT_PUBLIC_API_PATH="/public"
VITE_MGMT_API_KEY="admin"
```

**Speech Engine Mode (.env.speech-engine)**:
```bash
VITE_APP_MODE=speech-engine
VITE_MGMT_API_URL="http://localhost"
VITE_MGMT_API_PORT="28081"
VITE_MGMT_API_PATH="/api"
VITE_MGMT_PUBLIC_API_PATH="/public"
VITE_MGMT_API_KEY="admin"
```

### Build for Production

```bash
# Build optimized production bundle for Harmony Link
npm run build

# Build optimized production bundle for Speech Engine
npm run build:speech-engine

# Preview production build
npm run preview
```

## Docker Deployment

### Building the Image

```bash
# Build Harmony Link mode image
docker build -f Dockerfile.harmony-link -t harmony-link-ui .

# Build Harmony Speech Engine mode image
docker build -f Dockerfile.speech-engine -t harmonyspeech-ui .

# Run the Speech Engine mode image
docker run -p 8080:80 harmonyspeech-ui
```

### Using Pre-built Images

```bash
# Pull and run the latest Harmony Speech Engine UI image
docker pull harmonyai/harmonyspeech-ui:latest
docker run -p 8080:80 harmonyai/harmonyspeech-ui:latest
```

## API Integration

The UI communicates with Harmony backends through:

- **Management API**: Configuration, entity management, and system control
- **Events API**: Real-time event monitoring and development tools
- **Public API**: Status and health checks

Ensure your target backend (Harmony Link or Harmony Speech Engine) is running and accessible at the configured API endpoints.

## Project Structure

```
src/
├── components/          # React components
│   ├── integrations/   # Integration management components
│   ├── modules/        # AI module configuration components
│   └── settings/       # System settings components
├── services/           # API service layer
├── assets/             # Static assets and images
└── utils/              # Utility functions
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

Licensed under the Apache 2.0 License - see the [LICENSE](LICENSE) file for details.

---

## About Project Harmony.AI
![Project Harmony.AI](https://raw.githubusercontent.com/harmony-ai-solutions/harmony-link-private/main/docs/images/Harmony-Main-Banner-200px.png)

### Our goal: Elevating Human <-to-> AI Interaction beyond known boundaries.

Project Harmony.AI emerged from the idea to allow for a seamless living together between AI-driven characters and humans. This UI component is part of our larger ecosystem designed to democratize AI character development and deployment.

### How to reach out to us

[Official Website of Project Harmony.AI](https://project-harmony.ai/)

#### If you want to collaborate or support this Project financially:

Feel free to join our Discord Server and / or subscribe to our Patreon - Even $1 helps us drive this project forward.

![Harmony.AI Discord Server](https://raw.githubusercontent.com/harmony-ai-solutions/harmony-link-private/main/docs/images/discord32.png) [Harmony.AI Discord Server](https://discord.gg/f6RQyhNPX8)

![Harmony.AI Patreon](https://raw.githubusercontent.com/harmony-ai-solutions/harmony-link-private/main/docs/images/patreon32.png) [Harmony.AI Patreon](https://patreon.com/harmony_ai)

#### If you want to use our software commercially or discuss a business or development partnership:

Contact us directly via: [contact@project-harmony.ai](mailto:contact@project-harmony.ai)

---
&copy; 2023-2025 Harmony AI Solutions & Contributors

*Harmony Link UI is licensed and distributed under the Apache 2.0 License*
