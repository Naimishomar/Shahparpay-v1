# Shahparpay Mobile App

React Native mobile app for Shahparpay - Financial Services Platform

## Features

- **Cross-platform**: iOS, Android, and Web
- **Design System**: Matches web frontend UI exactly
- **Authentication**: OTP-based login with secure token management
- **Role-based Access**: Retailer, Distributor, Admin portals
- **Real-time Data**: Wallet balances, dashboard stats, transaction history
- **Offline Support**: Cached data with background sync
- **Dark/Light Mode**: System-aware theme switching

## Tech Stack

- **Framework**: Expo (React Native)
- **Navigation**: React Navigation v6 (Stack)
- **State Management**: React Context + Zustand
- **Styling**: React Native `StyleSheet` with a light/dark palette (`src/theme/colors.ts`)
- **Icons**: Expo Vector Icons (Ionicons, MaterialCommunityIcons)
- **Storage**: AsyncStorage for persistence
- **API**: Axios with interceptors

## Project Structure

```
app/
├── src/
│   ├── components/
│   │   ├── ui/           # Reusable UI components (Button, Input, Card)
│   │   └── layout/       # Layout components (Header, Sidebar, MainLayout)
│   ├── screens/
│   │   ├── auth/         # Login, Landing screens
│   │   ├── retailer/     # Retailer dashboard & services
│   │   ├── admin/        # Admin portal screens
│   │   └── distributor/  # Distributor portal screens
│   ├── navigation/       # Navigation configuration
│   ├── context/          # React Context providers (Auth, Theme)
│   ├── services/         # API service layer
│   ├── hooks/            # Custom React hooks
│   ├── constants/        # App constants & config
│   ├── theme/            # Design tokens (colors, spacing, etc.)
│   ├── types/            # TypeScript type definitions
│   └── assets/           # Static assets (logo, images)
├── scripts/check-routes.js  # `npm run check`: menu routes + icon names
├── index.js              # Registers App.tsx as the root component
├── App.tsx               # App entry point
├── app.json              # Expo configuration
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript configuration
└── .env                  # Environment variables
```

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Android Studio / Xcode (for device testing)

### Installation

```bash
cd app
npm install
```

### Development

```bash
# Start development server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios

# Run on Web
npm run web
```

### Environment Variables

Create `.env` file in the app root:

```env
EXPO_PUBLIC_BACKEND_URL=http://your-backend-url:3000
```

## Design System

The app uses the exact same design tokens as the web frontend:

- **Colors**: HSL-based color system with CSS variables
- **Typography**: Inter font family
- **Spacing**: 4px base unit scale
- **Border Radius**: 0.75rem base radius
- **Shadows**: Consistent elevation system
- **Components**: Button, Input, Card variants matching web

## Key Screens

### Retailer Portal
- Dashboard with stats & quick actions
- AEPS Services (Withdrawal, Balance, Mini Statement)
- AEPS Settlement (Fund Transfer, Bulk Payout)
- PAN Card Application (NSDL)
- Lead Generation (Credit Cards, Loans, Insurance)
- ITR Filing (ITR-1 to ITR-4)
- UPI Payments (Collect, Pay, Scan)
- DMT (Domestic Money Transfer)
- Recharge & Bills (Mobile, DTH, Broadband)
- BBPS (Electricity, Gas, Water, Insurance)
- Wallet Transfer & Direct Payout
- Fund Request
- Biometric Support
- Pipe Status Monitoring

### Admin Portal
- Overview Dashboard
- Distributor Management
- Fund Request Approval
- Commission Reports
- User Creation

### Distributor Portal
- Overview Dashboard
- Retailer Management
- Fund Request Approval
- Retailer Creation
- Profile Management

## Authentication Flow

1. User enters identifier (User ID/Email/Phone) + Password
2. Backend sends OTP to registered email
3. User enters 6-digit OTP
4. On success: JWT token stored securely
5. Auto-refresh every 10 minutes
6. Role-based navigation routing

## API Integration

All API calls go through the centralized `api` service (`src/services/api.ts`):

- Automatic token attachment
- 401 handling with auto-logout
- Request/response interceptors
- Type-safe endpoints matching backend routes

## Theming

Theme context provides:
- `theme`: 'light' | 'dark' | 'system'
- `resolvedTheme`: Actual resolved theme
- `setTheme()`: Change theme
- `toggleTheme()`: Cycle through themes

Colors automatically adapt using CSS variables defined in `src/theme/colors.ts`.

## Building for Production

```bash
# Build for Android
eas build --platform android

# Build for iOS
eas build --platform ios

# Build for Web
expo export --platform web
```

## License

Proprietary - Shahparpay Networks