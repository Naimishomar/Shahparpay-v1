# BharatPays API Documentation

This document contains the complete API specifications, request formats, parameter descriptions, response structures, and callback webhooks for all services provided by **BharatPays** (`https://api.bharatpays.in`).

---

## Global Authentication & Headers

- **Base URL**: `https://api.bharatpays.in`
- **Authentication Method**: Bearer Token
- **Header**:
  ```http
  Authorization: Bearer <YOUR_BHARATPAYS_TOKEN>
  ```
- **Note**: For `GET` requests, `token` can be passed as a query parameter (`?token=YOUR_TOKEN`). For `POST` requests, pass the token in the `Authorization: Bearer <TOKEN>` header.

---

## 1. NSDL PAN Card API

NSDL PAN Card creation is a 2-step process.

### Step 1: Generate URL
- **Endpoint**: `GET /api/nsdl`
- **URL Sample**:
  ```http
  GET https://api.bharatpays.in/api/nsdl?customer_ref_id=12345&title=1&first_name=John&middle_name=D&last_name=Doe&gender=Male&mode=E&redirect_url=https://yourdomain.com/dashboard&email_id=john@example.com&token=YOUR_TOKEN
  ```

#### Parameters:
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `customer_ref_id` | String / Number | Yes | Unique reference ID from your system (numbers only recommended). |
| `title` | Number | Yes | `1` for Mr/Shri, `2` for Mrs/Shrimati. |
| `first_name` | String | Yes | Customer's first name. |
| `middle_name` | String | No | Customer's middle name. |
| `last_name` | String | Yes | Customer's last name. |
| `gender` | String | Yes | `Male`, `Female`, or `Transgender`. |
| `mode` | String | Yes | `E` for Electronic PAN (E-PAN), `P` for Physical PAN. |
| `email_id` | String | Conditional | Required if `mode=E`. |
| `redirect_url` | String | Yes | Return URL after NSDL process completion. |
| `token` | String | Yes | Your BharatPays API Token. |

#### Response:
- **Success (`success: 1`)**:
  ```json
  {
    "success": 1,
    "message": "URL Generated Successfully",
    "data": {
      "id": 15,
      "response_url": "https://paysprint.in/service-api/api/v1/service/pan/V2/validateurl",
      "encdata": "dsfafadsfds/xMxq5Fw9WM5/42vAsw2+..."
    }
  }
  ```
- **Failure (`success: 0`)**:
  ```json
  {
    "success": 0,
    "message": "Failed to Generate URL"
  }
  ```

---

### Step 2: Redirect User to NSDL Portal
Submit a POST form directly to the `response_url` received in Step 1.

- **Method**: `POST` to `response_url`
- **Fields**:
  - `encdata`: Encrypted string received from Step 1.

#### Form Redirect Example:
```html
<form id="nsdlForm" action="RESPONSE_URL_HERE" method="POST">
  <input type="hidden" name="encdata" value="ENCDATA_HERE" />
</form>
<script>document.getElementById('nsdlForm').submit();</script>
```

---

### NSDL Webhook Callback
Configure your Webhook Callback URL in the BharatPays Merchant Portal under API Settings.

- **Callback Payload Format**:
  ```json
  {
    "success": 1,
    "message": "Nsdl Txn Status Update.",
    "data": {
      "id": "15",
      "customer_ref_id": "12345",
      "status": "SUCCESS", // or "FAILED"
      "type": "nsdl"
    }
  }
  ```

---

## 2. Biometric PSA Registration API

- **Endpoint**: `POST /api/biometric_psa/register`

#### Request Parameters:
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | String | Yes | Name of Agent/User. |
| `contact_person` | String | Yes | Contact Person Name. |
| `mobile` | String | Yes | 10-digit Mobile Number. |
| `email` | String | Yes | Email Address. |
| `pan_no` | String | Yes | 10-character PAN number. |
| `pin` | String | Yes | 6-digit Pincode. |
| `state_id` | Number | Yes | State ID (refer to State & District list). |
| `district_id` | Number | Yes | District ID. |
| `location` | String | Yes | Location/City. |
| `address_line_1` | String | Yes | Address Line 1. |
| `address_line_2` | String | No | Address Line 2. |
| `address_line_3` | String | No | Address Line 3. |
| `address_line_4` | String | No | Address Line 4. |
| `ref_id` | String | No | Unique Reference ID (Max 40 chars). |

#### Response:
```json
{
  "success": 1,
  "message": "Bio PSA Agent Added Sucessfully",
  "data": {
    "psa_id": "PAYP-568",
    "status": "PENDING" // "PENDING", "APPROVED", or "REJECTED"
  }
}
```

---

## 3. Verification APIs

### A. Verify PAN (`pan_sync`)
- **Endpoint**: `GET /api/Verification/pan_sync`
- **Parameters**: `token`, `pan`
- **Response**:
  ```json
  {
    "success": 1,
    "message": "Pan verification Successfully.",
    "data": {
      "pan": "ABCDE1234F",
      "type": "Individual",
      "registered_name": "JOHN DOE",
      "valid": true,
      "message": "PAN verified successfully"
    }
  }
  ```

### B. Verify Bank Account (`bank_verification`)
- **Endpoint**: `GET /api/Verification/bank_verification`
- **Parameters**: `token`, `account_number`, `ifsc`
- **Response**:
  ```json
  {
    "success": 1,
    "message": "Account Verification Successfully!",
    "data": {
      "account_exists": true,
      "full_name": "JOHN DOE",
      "remarks": ""
    }
  }
  ```

### C. Verify Aadhaar (OTP Flow)
1. **Send OTP**: `GET /api/Verification?token=TOKEN&aadhaar_number=123456789012`
   - Returns `reference_id`.
2. **Verify OTP**: `GET /api/Verification/aadharverify_otp?token=TOKEN&otp=123456&ref_id=REFERENCE_ID`
   - Returns full verified demographic details (Name, Address, DOB, Gender, etc.).

---

## 4. Recharge API

- **Endpoint**: `POST /api/recharge` or `GET /api/recharge_get`
- **Parameters**:
  - `opr_code`: Operator Code (e.g., `1` for Airtel, etc.)
  - `mobile`: Mobile or DTH Number
  - `amount`: Amount in INR (Minimum `10`)
  - `reference_id`: Your unique reference ID

#### Response:
```json
{
  "success": 1,
  "message": "Success Message",
  "data": {
    "order_id": "123456",
    "reference_id": "REF12345",
    "status": "SUCCESS", // "SUCCESS", "PENDING", or "FAILED"
    "opr_txn_id": "6203733",
    "remark": "Txn successful"
  }
}
```

---

## 5. UPI Payout API

- **Endpoint**: `POST /api/upi_payout/create_payout`
- **Parameters**:
  - `vpa`: Customer UPI ID (`username@bank`)
  - `recepient_name`: Recipient Name
  - `email_id`: Email Address
  - `mobile_no`: Mobile Number
  - `amount`: Transfer Amount
  - `reference_id`: Unique Transaction Ref ID

#### Response:
```json
{
  "success": 1,
  "message": "Payout Request Submitted Successfully",
  "data": {
    "order_id": "682311611361",
    "recepient_name": "John Doe",
    "amount": "100.00",
    "reference_id": "REF9876"
  }
}
```

---

## Summary of Webhook Callback Types

When setting up your callback URL (`http://yourdomain.com/api/callback`), BharatPays passes a `type` parameter in the JSON payload:

| Service Type | Callback Payload `type` Value |
| :--- | :--- |
| **NSDL PAN Card** | `"nsdl"` |
| **EB Payment** | `"eb_payment"` |
| **UPI Payout** | `"upi_payout"` |
| **Biometric PSA Agent** | `"bio_psa_agent"` |
| **Biometric Payment** | `"bio_payment"` |
| **Policy** | `"policy"` |
| **Recharge** | Default recharge structure |
