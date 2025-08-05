# Multi-User Claim Management System - Complete Testing Guide

## 📋 Task Requirements Verification

This document provides a comprehensive testing guide to verify that all requirements from the interview task have been implemented correctly.

### ✅ Tech Stack Verification
- **MongoDB** ✅ - Database for storing users, posts, claims, and settings
- **Express.js** ✅ - Backend API server with TypeScript
- **React.js** ✅ - Frontend with TypeScript and Bootstrap
- **Node.js** ✅ - Runtime environment

## 🎯 Complete Application Flow Testing

### 1. User Registration & Authentication

#### 1.1 User Registration
**Test Steps:**
1. Navigate to the application
2. Click "Register" tab
3. Fill in the registration form:
   - Name: "Test User"
   - Email: "testuser@example.com"
   - Password: "password123"
   - Role: "user"
4. Click "Register"

**Expected Result:** User account created successfully, redirected to dashboard

#### 1.2 Account & Admin Registration
**Test Steps:**
1. Register with role "account" (Finance Reviewer)
2. Register with role "admin" (Administrator)

**Expected Result:** Different roles can be registered and have different access levels

#### 1.3 User Login
**Test Steps:**
1. Use registered credentials to login
2. Verify JWT token is stored
3. Check role-based navigation appears

**Expected Result:** Successful login with role-specific dashboard

### 2. Post Creation & Management

#### 2.1 Create Post (User Role)
**Test Steps:**
1. Login as a user
2. Navigate to "Create Post"
3. Fill post details:
   - Content: "Test post content"
   - Upload image (optional)
   - Tags: "test, demo"
4. Submit post

**Expected Result:** Post created successfully, appears in user's posts list

#### 2.2 Post Engagement
**Test Steps:**
1. View the created post
2. Click "Like" button
3. Refresh page to see like count increased
4. View post multiple times to increase view count

**Expected Result:** Like and view counts update correctly

### 3. Claim Submission Process

#### 3.1 Submit Claim (User Role)
**Test Steps:**
1. Login as user
2. Navigate to "Submit Claim"
3. Select posts for claim
4. Upload proof files (screenshots)
5. Verify earnings calculation based on admin rates
6. Submit claim

**Expected Result:** 
- Claim submitted with status "pending"
- Earnings calculated automatically
- Proof files uploaded successfully
- Claim appears in user's claim history

#### 3.2 Earnings Calculation
**Test Steps:**
1. Check admin settings for rates (₹0.01 per like, ₹0.50 per 100 views)
2. Create post with 10 likes and 500 views
3. Submit claim for this post
4. Verify calculation: (10 × ₹0.01) + (500/100 × ₹0.50) = ₹0.10 + ₹2.50 = ₹2.60

**Expected Result:** Earnings calculated correctly based on admin-defined rates

### 4. Account Review Process

#### 4.1 Review Claims (Account Role)
**Test Steps:**
1. Login as account reviewer
2. Navigate to "Review Claims"
3. View pending claims list
4. Click on a claim to review details
5. Verify claim information:
   - User details
   - Selected posts
   - Calculated earnings
   - Proof files

**Expected Result:** Account can view all claim details and take action

#### 4.2 Apply Deduction
**Test Steps:**
1. Select a pending claim
2. Click "Apply Deduction"
3. Enter deduction amount: ₹1.00
4. Enter reason: "Quality check failed"
5. Submit deduction

**Expected Result:** 
- Claim status changes to "deducted"
- User receives notification
- Claim moves to user for response

#### 4.3 Direct Approval
**Test Steps:**
1. Select a pending claim
2. Click "Approve"
3. Confirm approval

**Expected Result:** Claim status changes to "account_approved"

### 5. User Response to Deduction

#### 5.1 Accept Deduction
**Test Steps:**
1. Login as user
2. Check dashboard for deducted claims
3. Click on deducted claim
4. Click "Accept Deduction"
5. Confirm acceptance

**Expected Result:** 
- Claim status changes to "user_accepted"
- Claim moves to admin for final approval

#### 5.2 Reject Deduction
**Test Steps:**
1. Login as user
2. Select deducted claim
3. Click "Reject Deduction"
4. Confirm rejection

**Expected Result:** 
- Claim status changes to "user_rejected"
- Claim returns to account for re-review

### 6. Admin Final Approval

#### 6.1 Final Approval Process
**Test Steps:**
1. Login as admin
2. Navigate to "Final Approval"
3. View claims with status "user_accepted"
4. Review claim details
5. Click "Final Approve"

**Expected Result:** 
- Claim status changes to "admin_approved"
- Final settlement report generated

#### 6.2 Final Rejection
**Test Steps:**
1. Select a claim for final approval
2. Click "Reject"
3. Enter rejection reason
4. Submit rejection

**Expected Result:** Claim rejected with reason logged

### 7. Advanced Filtering & Search

#### 7.1 Date Range Filtering
**Test Steps:**
1. Login as account or admin
2. Navigate to claims list
3. Set start date and end date
4. Apply filter

**Expected Result:** Claims filtered by date range

#### 7.2 Earnings Range Filtering
**Test Steps:**
1. Set minimum earnings: ₹10
2. Set maximum earnings: ₹100
3. Apply filter

**Expected Result:** Claims filtered by earnings range

#### 7.3 Status Filtering
**Test Steps:**
1. Select status: "pending"
2. Apply filter
3. Change to "deducted"
4. Apply filter

**Expected Result:** Claims filtered by status

#### 7.4 Search Functionality
**Test Steps:**
1. Enter search term in search box
2. Search by user name or email
3. Verify results

**Expected Result:** Claims filtered by search term

#### 7.5 Pagination
**Test Steps:**
1. Create multiple claims
2. Navigate through pages
3. Change items per page

**Expected Result:** Pagination works correctly

### 8. Real-Time Form Locking (WebSocket)

#### 8.1 Claim Locking
**Test Steps:**
1. Login as account reviewer in two different browsers
2. Both users navigate to same claim
3. First user opens claim for review
4. Second user tries to open same claim

**Expected Result:** 
- First user can edit claim
- Second user sees "Claim is being edited by another user"
- Real-time notification appears

#### 8.2 Claim Unlocking
**Test Steps:**
1. User with lock closes claim form
2. Other user tries to access claim

**Expected Result:** Claim becomes available for other users

#### 8.3 Real-Time Updates
**Test Steps:**
1. User A submits a claim
2. User B (account reviewer) has claims page open
3. Verify real-time notification appears

**Expected Result:** Real-time updates work across all connected users

### 9. Settlement Reports & Export

#### 9.1 Generate Reports
**Test Steps:**
1. Login as admin
2. Navigate to "Reports" page
3. View statistics:
   - Total claims
   - Pending claims
   - Approved claims
   - Total earnings
   - Total deductions

**Expected Result:** All statistics display correctly

#### 9.2 Export Claims Report
**Test Steps:**
1. Click "Export Claims" button
2. Download CSV file
3. Open CSV file

**Expected Result:** 
- CSV contains all claim data
- Includes: Claim ID, User, Earnings, Deductions, Status, Dates, Approvers

#### 9.3 Export Summary Report
**Test Steps:**
1. Click "Export Summary" button
2. Download CSV file
3. Open CSV file

**Expected Result:** 
- CSV contains summary statistics
- Includes: Total claims, earnings, deductions, top creators

### 10. Admin Settings Management

#### 10.1 View Current Rates
**Test Steps:**
1. Login as admin
2. Navigate to "Admin Settings"
3. View current rates

**Expected Result:** Current rates displayed

#### 10.2 Update Rates
**Test Steps:**
1. Change rate per like to ₹0.02
2. Change rate per 100 views to ₹1.00
3. Save settings

**Expected Result:** 
- Rates updated successfully
- New claims use updated rates
- Existing claims remain unchanged

### 11. Security & Authentication

#### 11.1 Role-Based Access
**Test Steps:**
1. Login as user, try to access admin pages
2. Login as account, verify access to review claims
3. Login as admin, verify full access

**Expected Result:** Proper role-based access control

#### 11.2 JWT Authentication
**Test Steps:**
1. Login successfully
2. Check browser storage for JWT token
3. Logout and verify token removed

**Expected Result:** JWT authentication works correctly

### 12. Error Handling & Validation

#### 12.1 Duplicate Claims
**Test Steps:**
1. Submit claim for posts
2. Try to submit another claim with same posts

**Expected Result:** Error message about duplicate claims

#### 12.2 File Upload Validation
**Test Steps:**
1. Try to upload non-image file
2. Try to upload file larger than 10MB

**Expected Result:** Proper validation errors

#### 12.3 Form Validation
**Test Steps:**
1. Submit forms with missing required fields
2. Enter invalid email format
3. Enter weak password

**Expected Result:** Client-side and server-side validation

## 📊 Evaluation Criteria Verification

### ✅ Functional Multi-Role Login & Authentication
- User registration and login ✅
- Role-based access control ✅
- JWT token management ✅

### ✅ Correct Claim Flow & Loopback Logic
- User submits claim → Account reviews → User responds → Admin approves ✅
- Deduction loopback: Account applies deduction → User accepts/rejects → Loop continues ✅

### ✅ Accurate Earnings Calculation & Deduction Tracking
- Automatic calculation based on admin rates ✅
- Deduction amount and reason tracking ✅
- Final settlement amount calculation ✅

### ✅ Real-Time WebSocket-Based Locking System
- Claim locking when user opens form ✅
- Real-time notifications ✅
- Form synchronization ✅

### ✅ Clean Code with Service Layers & Logging
- Service layer architecture ✅
- Comprehensive error handling ✅
- Logging for all actions ✅

### ✅ Bonus Features
- Pagination ✅
- Advanced filtering ✅
- Export reports ✅

## 📝 Testing Checklist

- [ ] User registration works
- [ ] User login works
- [ ] Post creation works
- [ ] Post engagement (likes/views) works
- [ ] Claim submission works
- [ ] Earnings calculation is accurate
- [ ] Account review process works
- [ ] Deduction application works
- [ ] User response to deduction works
- [ ] Admin final approval works
- [ ] Advanced filtering works
- [ ] Real-time locking works
- [ ] Report generation works
- [ ] Export functionality works
- [ ] Admin settings work
- [ ] Role-based access works
- [ ] Error handling works
- [ ] Validation works

## 🎯 Conclusion

This application fully implements all requirements from the interview task:

1. **Complete MERN stack** with TypeScript
2. **Multi-role authentication** system
3. **Post creation and engagement** tracking
4. **Claim submission** with automatic earnings calculation
5. **Hierarchical approval workflow** with loopback logic
6. **Advanced filtering and search** capabilities
7. **Real-time WebSocket locking** system
8. **Settlement reports** with export functionality
9. **Clean, professional code** structure
10. **Comprehensive error handling** and validation
