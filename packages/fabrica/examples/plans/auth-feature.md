---
repo: owner/example-app
base_branch: main
model: sonnet
timeout: 45m
parallel: true
---

# Feature: Add user authentication

## Overview

Implement JWT-based authentication for the application, including login, logout, and session management. This feature will secure all protected routes and enable user-specific functionality.

## Task 1: Design auth architecture
> Role: architect
> Depends on: none

Design the JWT-based authentication system. Define interfaces, data flow, and security considerations.

### Acceptance Criteria
- [ ] Architecture document created in docs/
- [ ] Interfaces defined for AuthService
- [ ] Token flow documented (access + refresh tokens)
- [ ] Security considerations documented

## Task 2: Implement auth middleware
> Role: builder
> Depends on: Task 1

Implement JWT validation middleware based on architect's design.

### Acceptance Criteria
- [ ] Middleware validates JWT tokens
- [ ] Returns 401 for invalid/expired tokens
- [ ] Attaches user to request context
- [ ] Handles token refresh flow

## Task 3: Create login endpoint
> Role: builder
> Depends on: Task 2

Create POST /api/auth/login endpoint for user authentication.

### Acceptance Criteria
- [ ] Accepts email/password in request body
- [ ] Returns JWT access token on success
- [ ] Returns refresh token in httpOnly cookie
- [ ] Returns 401 on invalid credentials
- [ ] Rate limiting implemented

## Task 4: Create logout endpoint
> Role: builder
> Depends on: Task 3

Create POST /api/auth/logout endpoint for session termination.

### Acceptance Criteria
- [ ] Clears refresh token cookie
- [ ] Invalidates refresh token in database
- [ ] Returns 200 on success

## Task 5: Write auth tests
> Role: tester
> Depends on: Task 2, Task 3, Task 4

Create comprehensive tests for the authentication system.

### Acceptance Criteria
- [ ] Unit tests for JWT validation
- [ ] Unit tests for login flow
- [ ] Unit tests for logout flow
- [ ] Integration tests for auth flow
- [ ] Security edge cases tested
- [ ] Test coverage > 90%

## Task 6: Security review
> Role: reviewer
> Depends on: Task 2, Task 3, Task 4, Task 5

Review the auth implementation for security vulnerabilities.

### Acceptance Criteria
- [ ] No token exposure in logs
- [ ] Proper password hashing (bcrypt)
- [ ] No timing attacks possible
- [ ] CSRF protection in place
- [ ] Rate limiting working correctly
- [ ] Follows OWASP guidelines
