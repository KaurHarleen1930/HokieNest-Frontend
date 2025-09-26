# HokieNest - Virginia Tech Housing Platform

HokieNest is a comprehensive housing platform designed specifically for the Virginia Tech community. Students and staff can discover verified rental properties, connect with landlords, and find international student-friendly housing options.

## 🏠 Features

- **VT Community Focus**: Exclusively for Virginia Tech students and staff with @vt.edu email addresses
- **Smart Property Search**: Advanced filters for price, bedrooms, bathrooms, and international-friendly options
- **Verified Listings**: All properties are verified with clear international student support indicators
- **Secure Authentication**: Role-based access control (student/staff/admin)
- **Admin Panel**: User management and platform monitoring tools
- **Responsive Design**: Optimized for mobile, tablet, and desktop experiences
- **Dark Theme**: Modern VT-inspired design with maroon and orange accents

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd hokienest
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up the backend**
   ```bash
   npm run server:setup
   ```

4. **Start development servers**
   ```bash
   npm run dev
   ```

The frontend will be available at `http://localhost:5173` and the backend API at `http://localhost:4000`.

## 📋 Demo Accounts

Use these pre-configured accounts to test the application:

- **Student**: `jdoe@vt.edu` / `password`
- **Staff**: `staff@vt.edu` / `password`
- **Admin**: `admin@vt.edu` / `password`

## 🛠 Available Scripts

### Development
- `npm run dev` - Start both frontend and backend development servers
- `npm run dev:frontend` - Start only the frontend development server
- `npm run dev:backend` - Start only the backend development server

### Backend Management
- `npm run server:setup` - Install backend dependencies and set up database
- `npm run server:build` - Build the backend for production
- `npm run server:start` - Start the production backend server

### Production
- `npm run build` - Build frontend for production
- `npm run preview` - Preview production build locally

## 🏗 Architecture

### Frontend (React + TypeScript)
- **Framework**: React 18 with TypeScript
- **Routing**: React Router v6
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: Radix UI with custom variants
- **State Management**: React Query for server state, Context for auth
- **Form Handling**: React Hook Form with Zod validation

### Backend (Node.js + Express)
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: SQLite with Prisma ORM
- **Authentication**: JWT with bcrypt password hashing
- **Validation**: Zod schema validation

### Security Features
- VT email validation (@vt.edu required)
- JWT token authentication
- Role-based authorization
- Password hashing with bcrypt
- CORS protection
- Input validation and sanitization
- CSP headers for XSS protection

## 📁 Project Structure

```
hokienest/
├── src/                      # Frontend source code
│   ├── components/           # Reusable React components
│   ├── pages/               # Page components
│   ├── lib/                 # Utilities and API clients
│   ├── design/              # Design system tokens
│   └── test/                # Test utilities
├── server/                   # Backend source code
│   ├── src/                 # Server source files
│   ├── prisma/              # Database schema and seeds
│   └── __tests__/           # Backend tests
├── e2e/                     # End-to-end tests
├── docs/                    # Documentation
└── public/                  # Static assets
```

## 🧪 Testing Strategy

### Unit Tests
- **Frontend**: Component testing with React Testing Library
- **Backend**: API endpoint testing with Jest and Supertest
- **Coverage**: Comprehensive test coverage for critical paths

### Integration Tests
- Authentication flow testing
- API integration testing
- Database operations testing

### End-to-End Tests
- Complete user journeys with Playwright
- Cross-browser testing (Chrome, Firefox, Safari)
- Mobile responsiveness testing

### Security Tests
- Admin authorization enforcement
- Authentication bypass prevention
- Input validation testing

## 🔒 Security Implementation

### Authentication & Authorization
- JWT-based authentication with 7-day expiration
- Role-based access control (student/staff/admin)
- Protected routes with automatic redirection
- Session validation on page refresh

### Data Protection
- Password hashing with bcrypt (12 rounds)
- VT email validation (@vt.edu requirement)
- Input sanitization with Zod schemas
- SQL injection prevention with Prisma

### Admin Security
- Admin-only routes protected server-side
- UI elements hidden for non-admin users
- User suspension capabilities
- Audit trail for admin actions

## 🌐 Deployment

### Frontend
Build the frontend for production:
```bash
npm run build
```

### Backend
1. Set environment variables in production
2. Build the backend:
   ```bash
   npm run server:build
   ```
3. Run database migrations:
   ```bash
   cd server && npm run prisma:migrate
   ```
4. Start the server:
   ```bash
   npm run server:start
   ```

### Environment Variables
Required environment variables for production:

**Backend (.env)**
```
DATABASE_URL="your-production-database-url"
JWT_SECRET="your-super-secure-jwt-secret"
PORT=4000
NODE_ENV=production
```

**Frontend**
```
VITE_API_BASE_URL="/api/v1"
```

## 🔍 SEO & Performance

### SEO Implementation
- Semantic HTML structure with proper headings
- Meta tags for title, description, and keywords
- Open Graph and Twitter Card support
- Canonical URLs for proper indexing
- Alt text for all images
- Clean, descriptive URLs

### Performance Optimizations
- Image lazy loading for faster page loads
- Component code splitting
- Optimized bundle sizes
- Skeleton loading states
- Efficient re-rendering with proper React keys

## 🎨 Design System

The HokieNest design system uses Virginia Tech's brand colors in a modern dark theme:

### Colors
- **Primary**: VT Maroon (#5E1A1A)
- **Accent**: VT Orange (#F47C2A)
- **Background**: Dark surfaces for modern appeal
- **Text**: High contrast for accessibility

### Typography
- **Font**: Inter for clarity and readability
- **Scale**: Responsive typography with proper line heights
- **Hierarchy**: Clear heading structure for accessibility

### Components
- Consistent spacing using 4px base grid
- Rounded corners with 8px/12px/16px scale
- Smooth transitions and hover effects
- Accessible focus states

## 🤝 Contributing

### Development Workflow
1. Create a feature branch from `main`
2. Make your changes with appropriate tests
3. Run the test suite to ensure everything passes
4. Submit a pull request with detailed description

### Code Standards
- TypeScript for type safety
- ESLint configuration for code consistency
- Prettier for code formatting
- Conventional commits for clear history

### Testing Requirements
- Unit tests for new components and functions
- Integration tests for API changes
- E2E tests for new user flows
- Maintain 80%+ test coverage

## 📝 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## 🆘 Support

For support or questions:
- Check the [documentation](docs/)
- Review existing [issues](issues/)
- Contact the development team

---

Built with ❤️ for the Virginia Tech community