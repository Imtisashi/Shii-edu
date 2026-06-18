# Shii-Edu API Documentation

## Overview
This document describes the API endpoints available in the Shii-Edu educational platform.

## Base URL
```
/api
```

## Authentication
Most endpoints require authentication. Include the Firebase ID token in the Authorization header:
```
Authorization: Bearer <firebase_id_token>
```

## Endpoints

### Authentication
#### Password Reset
- **POST** `/api/auth/password-reset`
  - Initiate password reset process
  - Requires: email
  - Returns: success/error message

### Notifications
#### Web Push Subscriptions
- **GET** `/api/notifications/web-push-subscriptions`
  - Get subscription status
  - Requires: authentication
  
- **POST** `/api/notifications/web-push-subscriptions`
  - Subscribe/unsubscribe to web push notifications
  - Requires: authentication
  - Body: { action: 'subscribe'|'unsubscribe', endpoint, keys }

### APK Distribution
#### APK Status
- **GET** `/api/apk-status`
  - Check availability of Android APK files
  - Query Parameters: role (driver|institute|parents|superadmin)
  - Returns: JSON with availability, file info, download URL

### Admin Endpoints
#### Branding
- **GET** `/api/admin/branding`
  - Get institute branding settings
  
- **POST** `/api/admin/branding`
  - Update institute branding
  - Body: { logoUrl, name, themeColor, etc."

#### Fees
- **POST** `/api/admin/fees/assign`
  - Assign fees to students
  
- **POST** `/api/admin/fees/record-payment`
  - Record fee payments

#### User Management
- **GET** `/api/admin/users`
  - List users with filtering
  
- **POST** `/api/admin/users/bulk`
  - Bulk user operations

### AI Services
#### Syllabus Processing
- **POST** `/api/ai/syllabus-ingest`
  - Upload and process syllabus documents
  
- **POST** `/api/ai/csv-map`
  - Map CSV data to database schema

- **POST** `/api/ai/substitute-schedule`
  - Generate substitute teacher schedules

### Communication
#### Messages
- **POST** `/api/messages`
  - Various messaging operations based on action parameter:
    - listConversations
    - listMessages
    - startConversation
    - sendMessage
    - getOfficeHours
    - setOfficeHours

### Super Admin
#### Institute Management
- **GET** `/api/super-admin/institutes`
  - List all institutes
  
- **POST** `/api/super-admin/institutes`
  - Create new institute and admin user
  
- **GET** `/api/super-admin/institutes/[instituteId]`
  - Get specific institute details
  
- **PATCH** `/api/super-admin/institutes/[instituteId]`
  - Update institute settings/features
  
- **DELETE** `/api/super-admin/institutes/[instituteId]`
  - Delete institute

### File Uploads
#### Media Upload
- **POST** `/api/media/upload-signature`
  - Get upload signature for media files
  
- **POST** `/api/cloudinary/signature`
  - Get Cloudinary upload signature

## Response Format
All API responses follow this format:
```json
{
  "success": boolean,
  "data": object|null,
  "error": string|null,
  "code": string|null,
  "requestId": string|null
}
```

## Error Codes
- `VALIDATION_ERROR`: Invalid input data
- `AUTHENTICATION_ERROR`: Missing or invalid credentials
- `AUTHORIZATION_ERROR`: Insufficient permissions
- `RESOURCE_NOT_FOUND`: Requested resource doesn't exist
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTERNAL_ERROR`: Unexpected server error

## Rate Limiting
API endpoints are rate-limited to prevent abuse:
- General endpoints: 100 requests per 15 minutes
- Auth endpoints: 20 requests per 15 minutes
- Payment endpoints: 10 requests per 15 minutes

## Versioning
API version is implied by the deployment. Backward compatibility is maintained within major versions.

## Security
- All endpoints require HTTPS
- Sensitive data is encrypted in transit and at rest
- Input validation and sanitization applied to all inputs
- CORS restrictions prevent unauthorized cross-origin requests
- Content Security Policy headers prevent XSS attacks

## Changelog
### v1.0.0 (Initial Release)
- Initial API release with core functionality
- Authentication, messaging, admin, and AI services