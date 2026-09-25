# Role Identification & Management Documentation

This document provides a comprehensive analysis of how user roles are defined, identified, stored, and validated within the application architecture.

## 1. Role Definition Locations

Roles are defined and referenced across several key architectural layers:

### A. Central Configuration (Single Source of Truth)
The primary definition contract is located in **`src/config/supabaseConfig.js`**. This file freezes the role constants to prevent mutation.