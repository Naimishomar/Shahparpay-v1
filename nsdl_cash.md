# NSDL Cash Deposit Transaction

# BODY parameter before encryption

MINIMUM REQUEST TIMEOUT TIME : 180 second

| PARAMETER                  | TYPE         | VALUE LIKE       |
| :------------------------- | :----------- | :--------------- |
| mobilenumber               | string       | 798299\*\*\*\*   |
| accessmodetype             | string       | APP OR SITE      |
| adhaarnumber               | string       | 2135364534\*\*\* |
| latitude                   | string       | 22.44543         |
| longitude                  | string       | 77.44543         |
| referenceno                | string       | 3454856          |
| nationalbankidentification | number       | 606985           |
| submerchantid              | alphanumeric |                  |
| data                       | xml string   |                  |
| timestamp                  | number       | 1679480150       |
| amount                     | number       | 500              |

# RESPONSE CODE

| SNo | HTTP Response Code | Response Code | Description                                                                   |
| :-- | :----------------- | :------------ | :---------------------------------------------------------------------------- |
| 1   | 200                | 1             | SUCCESS (Provided Message)                                                    |
| 2   | 200                | 0             | FAILED (Provided Message)                                                     |
| 3   | 200                | 2             | ERROR OR REQUEST TIMEOUT                                                      |
| 4   | 401                | 4             | AEPS pipe is not available yet                                                |
| 5   | 401                | 3             | Transaction Not initiated.                                                    |
| 6   | 401                | 5             | Provided Message                                                              |
| 7   | 406                | 18            | Please Provide a unique reference number                                      |
| 8   | 406                | 26            | Device is already mapped with other merchant, Please contact service provider |
| 9   | 406                | 27            | Fingerprint capture failed., Try again with Re Plug RD device                 |
| 10  | 406                | 27            | Fingerprint capture failed., Try again                                        |
| 11  | 404                | 24            | Merchant onboarding is not onboarded respective pipe                          |
| 12  | 404                | 25            | You do not have permission., Please onboard merchant                          |
| 13  | 404                | 12            | AEPS Service is down                                                          |
| 14  | 404                | 13            | Pipe is not activated for the partner user, Please contact service provider   |
| 15  | 401                | 15            | Invalid Partner details                                                       |
| 16  | 401                | 20            | Unable to decode body data                                                    |
| 17  | 401                | 9             | Unable to process balance request                                             |
| 18  | 401                | 10            | Invalid JWT Token sent in Header. OR Signature verification failed            |
| 19  | 401                | 8             | Validations Error                                                             |
| 20  | 401                | 11            | Authentication failed, Please contact service provider                        |
| 21  | 200                | 6             | Charges Not Set                                                               |
| 22  | 406                | 7             | The amount for transaction should be between 100 to 10000 only.               |

# Transaction Status

| txnstatus | Description |
| :-------- | :---------- |
| 0         | failed      |
| 1         | success     |
| 4         | hold        |

# OpenAPI definition

```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "Service API",
    "version": "1.0"
  },
  "servers": [
    {
      "url": "https://xyz.xyz.in/service-api/api/v1/service"
    }
  ],
  "security": [
    {}
  ],
  "paths": {
    "/cashdeposit/V3/Cashdeposit/index": {
      "post": {
        "summary": "NSDL Cash Deposit Transaction",
        "description": "",
        "operationId": "nsdl-cash-deposit-transaction",
        "parameters": [
          {
            "name": "Token",
            "in": "header",
            "required": true,
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "Authorisedkey",
            "in": "header",
            "description": "Authorized key is required to pass in UAT but not in Live environment, if partner not using shared IP.",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "RAW_BODY"
                ],
                "properties": {
                  "RAW_BODY": {
                    "type": "string",
                    "description": "AES encrypted value should be pass in body value",
                    "default": "{\"body\":\"5pLUORUiA6EIV5fm8f\\/1Y8bsfJ4A8\\/7s7v8mVT+PMpFFhgWYCMGIu\\/1s7JysMjXbrs9yEW7I7TxHbIJXyUnFbbhCSZHzZF3EiaE6bBPDKyrKLcidHYE1uCefc8KYT1Q6Q543nLQrQDneDg\\/jtm5F5C8NR2ZkaOe+FeDd+PrfGwGQpAVLEe+2wRbQNzYYosLfvtJNlgeik+iMWjIe0RFROhNmO+FFaF192zGEJEcL0YhYoSizv1LCx3PHxm3Xf8d3QueNYAV59BTbb31tcO1jrocX6umvRR7PlevT3Bdwi2XE8qSq\\/GZmMabADnc9fpFZI99SipjI9FcRPF4mfKTprxqVGrZd5jk3N1E8mk5XRV6QN7jKx5MK8DTjDT5eHeK34BR9bGUwIkIZ5nv8TqeXZ71PxtL\\/DjNwN1BJWzmIL8MsjIEj1u25t46GSFCn6Zcj\\/K4RYtErMNJ9yeTP9PwkZB4K\\/rvWmlOQEiL19KWYhtcyNqP\\/rVjh1EG7eDzh63eW3jaKnWhRBeHS0GkjMSjWPosMBRtZS+4NtGe20ms6ICogH+D8o0BJe821Hfhqq8l1OOZdNSL8m3JnsEJKgvSBOkwjZkqbGmyBxoFhlvieI2fZ2pjX12Rg9s1N\\/5AAV8L\\/XOXKlFUFrMXhJN0Hx2OvNvAbOrPALDRsbv8IJTWkrMHyrWE6EewffYmjcbvd318wVZMT9A0Q7k4jLlhU5\\/gtfIhfyEn\\/cW9JQ+LmIAHTpCdFS9qtrLVX89Y+pOQXeR4Tycu558ZE2R5adHxtBAqRoA27R9WUZGkjSLDakRCe2\\/101+v7hGZMQjvUvp85GKUnvM4Z63c0lG5BUT5HAwhBf2MN9eupXg71G2oKiQahJQqtyhQRPSRgt24TfDt2SJKjU9CcKjqdymjVVb\\/3T0\\/VPoa3J1DLmxpMsGgNiRSNuaYLQkBx0JswAi450SMPu3HEHo6p87gUieaA6OAy3Svcjc\\/JB0neAi1iR9WYuElYNHhjxPc89l4jeBQHUrrIfpZUNWc+Qb239E8K3Q1Kqawud3H8JkbU9mt8G3SPldEraOkyGUHyLVrBdmdgUUkVg+LjruLXJvIjyEyBuS+a+d35jHt1vaSes7tewF83erzIpesfMVvCs2gyv7XJEmycxo6sx\\/q7miXydyjbOkHkXSZY5RVzQEjdHvtJIuGHykJXxrc4riKd0PsTqe\\/RhTw5DlAqJ\\/pbZiChhOUM7uI16sXcDiaVD\\/HkSN0c07xF+SX\\/IRuuPIOFb3yMvXxbNsIK9N0vF8HRzTJ7VnySx2H\\/XiIoC\\/YXOGf5SqNiH3mNzwvmHSglbYdp1iMqPvIFrdMEuoMnRLCgZbLNUVehXHMldpgG+8fdJPYORIXrviyaazskmQWeG6qjYG61mFyr9rHJI3xLBWIjADFEWQisG7UpAlsNiCyuiVMu992\\/ZmkhzoLaP19+yPw6E5r5TkMAw7YjXgPR9ip8K3WauIGZUdf\\/4hiJAQeCIv95nomOEVvaebfUZ8lDMq0QreIVOn5FcXbzC6npiIH\\/15ktk\\/r\\/xmll+VPfkF3UQGSAsGCgMVRwKFLzyCOMrOZkWQCQ3mAXd9itKHo1grsNsGfLTEG1tEXvFo72wf5u2Rredfk4k4puL9IZX0F8T8b5HpUn3W8KbipJDI8ltlBNnVXONyhoNJrDDM5pJ15bMQjshm\\/QvXRhZ9oRxYWBY1ko\\/NV3si\\/tNJL4X6nFOhJgaQlA+6FmJVdloiWHpwOMKUa2e8OYDwm4paJglyElDGjZ4PZU60ZJh+Eyqg80L9\\/Ak\\/2PQQ3ZIc9lGXH3Scp7KVe7MTyH2QodyQlwphMpjG2\\/\\/AIo1I\\/69JLEzIZnpfdB7Xe37F1uLTefaKiENLsoukWjNT6MEhQ4HO6fqKpZt7Mnl96BYhjyJy87IXcdkP3ZMXOwpn9JFedN6diO4KmfV1\\/cLS1N\\/S9tXfb+XxmbIzAJXkn+8RA01IAWChmeE6tWWxWe5VOUQpz9WfKLsPMMkIsekO\\/mF7AkilaElN1bT7u8qEJ++RRalvY4DFYAWN2egVG81iWZliGfYwhFMGmucC+5TVf8Zkr32LDMnXWLAEvrlVH+Q35mtFImM6OXCdwL\\/T0XbHbhTT0zjCZqyMlhLLXkVlkDujDwOVzwv8y1IscphFxFNJ0mPltRZldk45xd6+u4COIzLcWd08xDccynIJ22V4rm0IwQFgdhPuSKS7yBmtvtrXnNSymUiq87P\\/c3OFfyPyKgaHw0mFi6JKq\\/jpDXlG+nwBsocn9uvxk9\\/vR4kKvA+QTz+ebVI7zYZlRwHvOLiToMswS7OAklbPj1ktF19dhXiNvH0fA+0GsDCr+7P9NJliz\\/zkXTY\\/RQG3DWysHRScu\\/1PNJYtPTY6dpVAe1Hcn3C+LB5aOm+MqCAiwrZgxb+vS8kvMN9NZ3rzFcYQosqSwLLlcpGkn7Z4mMeTUAPMcVAM9MoncRw2Q\\/enWdFNg5gRcofs6P0vjSWvwjJf\\/thH4cQCOPcYR9+ZuqnjfcThlYQy50RPi9ps+en4pfOaRjJ4In71EPr768WLvgof9mXlZqz2RJJT4dSZQtaMwszXR55IoAXrzcLW5IZ6UOrUa0Isb103OklokbRg51lIGubODo+KADnMB3BUxdAsx8fbf7e+51LVG3JgW+zeyt3DBvHvbwIofA7DVrH2\\/xDDKgIyHlA4JcPQKWZLsT5oM2KAsm37RZGnOHp6hC8qy+h2VSO+XF2mLyc5nHjdAXpi7pMGM56DDHga81vXrtp+4By+2M1aJ3XhbV05UtUc2N9k437+ewrWw\\/EOjnlSNRnpBCgWTtVr5MWZrGQZuGOEq1E0Kvvmx2hBFc+DxtV7qzqE+9QRHvzUm9ugJgD4turfmy6eogN1q4AJI+v\\/R9tYTSc3v0Sv+VA\\/GdAuI32NGEgrx9EXgPlx6KUN5xTKatLC5NaV+9XcASk0I1VlKK8oGD8kEZoS4CtFMpc3q34LrvtJPcA0LoqNsEv\\/lrUqnCmfOFVWXn3\\/7jfoVna+hzeCRIi7qByvD0BCqauNaA2RWyDu40nLncPnH3pNm5LP1C6cMGRXYayvMqXE4w9TB2GTdfHwSIBeWGE3NY2F663Cf2rHiP9uENDPtKu4gGymI3WBex+BetotGjLGZg27SFOIo\\/EVujqhVxpPMnn1r9uBDRK1uxkasM2u2eOO+Qd+pzYNsl0WprzBkCOnd3oLm1xC+9EoNkz0ImbUlVws3ncsVNlV9KcAvYJKG8O+moaN22ZIN66h0LP+kSlsJTlHb9q9NJGAjCxehVwcedq\\/Y82dw6SO0A4kA+Cj5Sa3KqCQ\\/ARkbiIUez09A0Xiv\\/5VDBoH+zM5S7X\\/LsMZ5c0IdtEws+Wh9SKF27HG7jvEoMjVJB1sUitwPMc5XYq1NIZ+sABCi3rgtN0E0MypRybW7EsyeMOcGzs6Wfbfk1u8o5MkHeW2ShyWzvz0+GXXVq2KG9FeJrG9E6c7ZGshH3SzvhiKPyXsULM1NBKFFYYcf\\/GcbzaXzQcQ9oRo4HC8RbqDsMFKG0WjBFPUjwME4WdCMDOJ6RI7Gv3aNsi96BGafw+uAiZrUVM6VN5kLsFb86LNTnlX3xlaEzHLB+txh0HBPPVdwODS67J\\/ZLx5A=\"}"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "200",
            "content": {
              "application/json": {
                "examples": {
                  "Result": {
                    "value": "{\n    \"response_code\": 1,\n    \"status\": true,\n    \"message\": \"SUCCESS\",\n    \"ackno\": 1209,\n    \"amount\": \"500\",\n    \"bankrrn\": \"852754739123\",\n    \"bankiin\": \"607063\",\n    \"mobile\": \"7409710169\",\n    \"errorcode\": \"0\",\n    \"clientrefno\": \"638729660448982263\",\n    \"last_aadhar\": \"7142\",\n    \"name\": \"NITISH KUMAR\"\n}"
                  }
                },
                "schema": {
                  "type": "object",
                  "properties": {
                    "response_code": {
                      "type": "integer",
                      "example": 1,
                      "default": 0
                    },
                    "status": {
                      "type": "boolean",
                      "example": true,
                      "default": true
                    },
                    "message": {
                      "type": "string",
                      "example": "SUCCESS"
                    },
                    "ackno": {
                      "type": "integer",
                      "example": 1209,
                      "default": 0
                    },
                    "amount": {
                      "type": "string",
                      "example": "500"
                    },
                    "bankrrn": {
                      "type": "string",
                      "example": "852754739123"
                    },
                    "bankiin": {
                      "type": "string",
                      "example": "607063"
                    },
                    "mobile": {
                      "type": "string",
                      "example": "7409710169"
                    },
                    "errorcode": {
                      "type": "string",
                      "example": "0"
                    },
                    "clientrefno": {
                      "type": "string",
                      "example": "638729660448982263"
                    },
                    "last_aadhar": {
                      "type": "string",
                      "example": "7142"
                    },
                    "name": {
                      "type": "string",
                      "example": "NITISH KUMAR"
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "400",
            "content": {
              "application/json": {
                "examples": {
                  "Result": {
                    "value": "{}"
                  }
                },
                "schema": {
                  "type": "object",
                  "properties": {}
                }
              }
            }
          }
        },
        "deprecated": false
      }
    }
  },
  "x-readme": {
    "headers": [
      {
        "key": "Token",
        "value": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJQQVlTUFJJTlQiLCJ0aW1lc3RhbXAiOjE2MTAwMjYzMzgsInBhcnRuZXJJZCI6IlBTMDAxIiwicHJvZHVjdCI6IldBTExFVCIsInJlcWlkIjoxNjEwMDI2MzM4fQ.buzD40O8X_41RmJ0PCYbBYx3IBlsmNb9iVmrVH9Ix64"
      }
    ],
    "explorer-enabled": true,
    "proxy-enabled": true
  },
  "x-readme-fauxas": true,
  "_id": "600fb8034bda1000120c8002:66e81ff5239860001290bbdb"
}
```