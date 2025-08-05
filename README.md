# Multi-User Claim Management System

A MERN stack application for managing content creator claims with role-based approval workflow.

## Tech Stack

- **Frontend**: React, TypeScript, Bootstrap
- **Backend**: Node.js, Express, TypeScript, MongoDB
- **Real-time**: Socket.IO
- **Authentication**: JWT

## Quick Start

### Backend
```bash
cd backend
npm install
cp env.example .env
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm start
```

## Features

- User authentication with role-based access
- Post creation and management
- Claim submission and approval workflow
- Real-time claim locking
- File upload for proof documents
- Dashboard with statistics

## Roles

- **User**: Submit claims and manage posts
- **Account**: Review and approve claims
- **Admin**: Final approval and system management 