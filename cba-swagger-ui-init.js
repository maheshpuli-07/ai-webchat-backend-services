
window.onload = function() {
  // Build a system
  var url = window.location.search.match(/url=([^&]+)/);
  if (url && url.length > 1) {
    url = decodeURIComponent(url[1]);
  } else {
    url = window.location.origin;
  }
  var options = {
  "swaggerDoc": {
    "openapi": "3.0.3",
    "info": {
      "title": "CBA Mock Server",
      "version": "1.0.0",
      "description": "Mock API server for CBA applications with dynamic route configuration"
    },
    "servers": [
      {
        "url": "http://192.168.3.99:4000",
        "description": "CBA Mock Server"
      }
    ],
    "paths": {
      "/api/Customer/GetByCustomerPhoneNumber": {
        "get": {
          "summary": "Get Customer By Phone Number",
          "description": "Stateful simulator endpoint that retrieves customer information by phone number from PostgreSQL database. Returns customer details with all associated accounts.",
          "tags": [
            "Customer",
            "Simulator"
          ],
          "parameters": [
            {
              "name": "phoneNumber",
              "in": "query",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "Customer phone number",
              "example": "9988770011"
            },
            {
              "name": "authToken",
              "in": "query",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "Authentication token",
              "example": "617a8d1e-d292-4036-b2f2-51fdaf3dc003"
            }
          ],
          "responses": {
            "200": {
              "description": "Customer found - returns array with customer and accounts. Returns empty array [] if customer not found.",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "Id": {
                          "type": "integer",
                          "example": 0
                        },
                        "customerID": {
                          "type": "string",
                          "example": "000001"
                        },
                        "LastName": {
                          "type": "string",
                          "example": "Doe"
                        },
                        "Gender": {
                          "type": "integer",
                          "nullable": true,
                          "example": 0
                        },
                        "GenderString": {
                          "type": "string",
                          "nullable": true,
                          "example": "Male"
                        },
                        "OtherNames": {
                          "type": "string",
                          "example": "John"
                        },
                        "PhoneNumber": {
                          "type": "string",
                          "example": "9988770011"
                        },
                        "BankVerificationNumber": {
                          "type": "string",
                          "example": "12345678901"
                        },
                        "Email": {
                          "type": "string",
                          "example": "john.doe@example.com"
                        },
                        "Accounts": {
                          "type": "array",
                          "items": {
                            "type": "object",
                            "properties": {
                              "AccountNumber": {
                                "type": "string",
                                "example": "1101234567"
                              },
                              "AccountStatus": {
                                "type": "string",
                                "example": "Active"
                              },
                              "AccountBalance": {
                                "type": "string",
                                "example": "0.00"
                              },
                              "NUBAN": {
                                "type": "string",
                                "example": "1101234567"
                              }
                            }
                          }
                        }
                      }
                    }
                  },
                  "example": [
                    {
                      "Id": 0,
                      "customerID": "000001",
                      "LastName": "Doe",
                      "Gender": 0,
                      "GenderString": "Male",
                      "OtherNames": "John",
                      "PhoneNumber": "9988770011",
                      "BankVerificationNumber": "12345678901",
                      "Email": "john.doe@example.com",
                      "Accounts": [
                        {
                          "AccessLevel": "1",
                          "AccountNumber": "1101234567",
                          "AccountStatus": "Active",
                          "AccountType": "SavingsOrCurrent",
                          "AccountBalance": "0.00",
                          "NUBAN": "1101234567"
                        }
                      ]
                    }
                  ]
                }
              }
            },
            "400": {
              "description": "Bad request - phoneNumber parameter missing",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "Message": {
                        "type": "string",
                        "example": "phoneNumber is required"
                      }
                    }
                  }
                }
              }
            },
            "401": {
              "description": "Unauthorized - invalid auth token",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "Message": {
                        "type": "string",
                        "example": "Unauthorized: invalid authToken"
                      }
                    }
                  }
                }
              }
            },
            "500": {
              "description": "Internal server error",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "Message": {
                        "type": "string",
                        "example": "Internal simulator error"
                      }
                    }
                  }
                }
              }
            },
            "503": {
              "description": "Service unavailable - CBA offline (simulated window)",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "Message": {
                        "type": "string",
                        "example": "CBA is offline (simulated window)"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/Account/GetAccountByTransactionTrackingRef": {
        "get": {
          "summary": "Get Account By Transaction Tracking Reference",
          "description": "Stateful simulator endpoint that retrieves account information by transaction tracking reference from PostgreSQL database. Returns account details with customer information.",
          "tags": [
            "Account",
            "Simulator"
          ],
          "parameters": [
            {
              "name": "transactionTrackingRef",
              "in": "query",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "Transaction tracking reference used when creating the account",
              "example": "TXN-001-2024-12-04"
            },
            {
              "name": "authToken",
              "in": "query",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "Authentication token",
              "example": "617a8d1e-d292-4036-b2f2-51fdaf3dc003"
            }
          ],
          "responses": {
            "200": {
              "description": "Account found - returns account details with customer information",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "AccessLevel": {
                        "type": "string",
                        "example": "1"
                      },
                      "AccountNumber": {
                        "type": "string",
                        "example": "1100337792"
                      },
                      "AccountStatus": {
                        "type": "string",
                        "example": "Active"
                      },
                      "AccountType": {
                        "type": "string",
                        "example": "SavingsOrCurrent"
                      },
                      "AvailableBalance": {
                        "type": "string",
                        "example": "0.00"
                      },
                      "WithdrawableBalance": {
                        "type": "string",
                        "example": "0"
                      },
                      "Branch": {
                        "type": "null",
                        "example": null
                      },
                      "CustomerID": {
                        "type": "string",
                        "example": "033779"
                      },
                      "CustomerName": {
                        "type": "string",
                        "example": "John, Doe"
                      },
                      "DateCreated": {
                        "type": "string",
                        "example": "8/8/2025 10:35:48 AM"
                      },
                      "LastActivityDate": {
                        "type": "string",
                        "example": "8/8/2025 10:35:48 AM"
                      },
                      "NUBAN": {
                        "type": "string",
                        "example": "1100337792"
                      },
                      "Refree1CustomerID": {
                        "type": "null",
                        "example": null
                      },
                      "Refree2CustomerID": {
                        "type": "null",
                        "example": null
                      },
                      "ReferenceNo": {
                        "type": "null",
                        "example": null
                      },
                      "PNDStatus": {
                        "type": "boolean",
                        "example": true
                      },
                      "AccountTier": {
                        "type": "string",
                        "example": "1"
                      }
                    }
                  },
                  "example": {
                    "AccessLevel": "1",
                    "AccountNumber": "1100337792",
                    "AccountStatus": "Active",
                    "AccountType": "SavingsOrCurrent",
                    "AvailableBalance": "0.00",
                    "WithdrawableBalance": "0",
                    "Branch": null,
                    "CustomerID": "033779",
                    "CustomerName": "John, Doe",
                    "DateCreated": "8/8/2025 10:35:48 AM",
                    "LastActivityDate": "8/8/2025 10:35:48 AM",
                    "NUBAN": "1100337792",
                    "Refree1CustomerID": null,
                    "Refree2CustomerID": null,
                    "ReferenceNo": null,
                    "PNDStatus": true,
                    "AccountTier": "1"
                  }
                }
              }
            },
            "400": {
              "description": "Bad request - transactionTrackingRef parameter missing",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "Message": {
                        "type": "string",
                        "example": "transactionTrackingRef is required"
                      }
                    }
                  }
                }
              }
            },
            "401": {
              "description": "Unauthorized - invalid auth token",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "Message": {
                        "type": "string",
                        "example": "Unauthorized: invalid authToken"
                      }
                    }
                  }
                }
              }
            },
            "404": {
              "description": "Account not found for given transactionTrackingRef",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "Message": {
                        "type": "string",
                        "example": "Account not found for given transactionTrackingRef"
                      }
                    }
                  }
                }
              }
            },
            "500": {
              "description": "Internal server error",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "Message": {
                        "type": "string",
                        "example": "Internal simulator error"
                      }
                    }
                  }
                }
              }
            },
            "503": {
              "description": "Service unavailable - CBA offline (simulated window)",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "Message": {
                        "type": "string",
                        "example": "CBA is offline (simulated window)"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/Account/GetAccountsByCustomerId": {
        "get": {
          "summary": "Get Accounts By Customer ID",
          "description": "Stateful simulator endpoint that retrieves customer information and all associated accounts by customer ID from PostgreSQL database. Returns customer details with all accounts in the Accounts array.",
          "tags": [
            "Account",
            "Simulator"
          ],
          "parameters": [
            {
              "name": "customerId",
              "in": "query",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "Customer ID (6-digit padded string, e.g., \"033779\" or \"075529\")",
              "example": "033779"
            },
            {
              "name": "authToken",
              "in": "query",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "Authentication token",
              "example": "617a8d1e-d292-4036-b2f2-51fdaf3dc003"
            }
          ],
          "responses": {
            "200": {
              "description": "Customer found - returns customer details with all accounts",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "Id": {
                        "type": "integer",
                        "example": 0
                      },
                      "customerID": {
                        "type": "string",
                        "example": "075529"
                      },
                      "LastName": {
                        "type": "string",
                        "example": "Dillon"
                      },
                      "Gender": {
                        "type": "integer",
                        "nullable": true,
                        "example": 0
                      },
                      "GenderString": {
                        "type": "string",
                        "nullable": true,
                        "example": "Male"
                      },
                      "OtherNames": {
                        "type": "string",
                        "example": "Bunch"
                      },
                      "PhoneNumber": {
                        "type": "string",
                        "example": "8093332686"
                      },
                      "BankVerificationNumber": {
                        "type": "string",
                        "example": "89873627190"
                      },
                      "Email": {
                        "type": "string",
                        "example": "bunch.dillon@mail.com"
                      },
                      "Accounts": {
                        "type": "array",
                        "items": {
                          "type": "object",
                          "properties": {
                            "AccountNumber": {
                              "type": "string",
                              "example": "1100755299"
                            },
                            "AccountStatus": {
                              "type": "string",
                              "example": "Active"
                            },
                            "AccountBalance": {
                              "type": "string",
                              "example": "10.00"
                            },
                            "NUBAN": {
                              "type": "string",
                              "example": "1100755299"
                            }
                          }
                        }
                      }
                    }
                  },
                  "example": {
                    "Id": 0,
                    "customerID": "075529",
                    "LastName": "Dillon",
                    "Gender": 0,
                    "GenderString": "Male",
                    "OtherNames": "Bunch",
                    "Address": "Nigeria",
                    "Email": "bunch.dillon@mail.com",
                    "PhoneNumber": "8093332686",
                    "BankVerificationNumber": "89873627190",
                    "Accounts": [
                      {
                        "AccessLevel": "1",
                        "AccountNumber": "1100755299",
                        "AccountStatus": "Active",
                        "AccountType": "SavingsOrCurrent",
                        "AccountBalance": "10.00",
                        "CustomerID": "075529",
                        "CustomerName": "Dillon, Bunch",
                        "DateCreated": "10/28/2025 6:33:32 AM",
                        "LastActivityDate": "9/9/2020 12:00:00 AM",
                        "NUBAN": "1100755299"
                      }
                    ]
                  }
                }
              }
            },
            "400": {
              "description": "Bad request - customerId parameter missing or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "Message": {
                        "type": "string",
                        "example": "customerId is required"
                      }
                    }
                  }
                }
              }
            },
            "401": {
              "description": "Unauthorized - invalid auth token",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "Message": {
                        "type": "string",
                        "example": "Unauthorized: invalid authToken"
                      }
                    }
                  }
                }
              }
            },
            "404": {
              "description": "Customer not found for given customerId",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "Message": {
                        "type": "string",
                        "example": "Customer not found for given customerId"
                      }
                    }
                  }
                }
              }
            },
            "500": {
              "description": "Internal server error",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "Message": {
                        "type": "string",
                        "example": "Internal simulator error"
                      }
                    }
                  }
                }
              }
            },
            "503": {
              "description": "Service unavailable - CBA offline (simulated window)",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "Message": {
                        "type": "string",
                        "example": "CBA is offline (simulated window)"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/Account/GetTransactions": {
        "get": {
          "summary": "Get Transactions",
          "description": "Stateful simulator endpoint that retrieves transaction history for an account from PostgreSQL database. Supports date range filtering and result limiting. Returns transactions in CBA-style format with opening/closing balances, debit/credit indicators, and formatted dates.",
          "tags": [
            "Account",
            "Simulator"
          ],
          "parameters": [
            {
              "name": "accountNumber",
              "in": "query",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "Account NUBAN number",
              "example": "1100313855"
            },
            {
              "name": "fromDate",
              "in": "query",
              "required": false,
              "schema": {
                "type": "string",
                "format": "date"
              },
              "description": "Start date for filtering transactions (YYYY-MM-DD)",
              "example": "2023-12-31"
            },
            {
              "name": "toDate",
              "in": "query",
              "required": false,
              "schema": {
                "type": "string",
                "format": "date"
              },
              "description": "End date for filtering transactions (YYYY-MM-DD, inclusive)",
              "example": "2025-12-31"
            },
            {
              "name": "numberOfItems",
              "in": "query",
              "required": false,
              "schema": {
                "type": "integer",
                "default": 100
              },
              "description": "Maximum number of transactions to return",
              "example": 100
            },
            {
              "name": "authToken",
              "in": "query",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "Authentication token",
              "example": "617a8d1e-d292-4036-b2f2-51fdaf3dc003"
            }
          ],
          "responses": {
            "200": {
              "description": "Transactions retrieved successfully",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": true
                      },
                      "CustomerIDInString": {
                        "type": "string",
                        "nullable": true,
                        "example": null
                      },
                      "Message": {
                        "type": "array",
                        "items": {
                          "type": "object",
                          "properties": {
                            "Id": {
                              "type": "integer",
                              "example": 723261
                            },
                            "CurrentDate": {
                              "type": "string",
                              "format": "date-time",
                              "example": "2025-07-28T13:46:32"
                            },
                            "IsReversed": {
                              "type": "boolean",
                              "example": false
                            },
                            "ReversalReferenceNo": {
                              "type": "string",
                              "nullable": true,
                              "example": null
                            },
                            "WithdrawableAmount": {
                              "type": "number",
                              "example": 0
                            },
                            "UniqueIdentifier": {
                              "type": "string",
                              "example": "020000183107281346320000000000000000000000"
                            },
                            "InstrumentNo": {
                              "type": "string",
                              "example": "250728134698"
                            },
                            "TransactionDate": {
                              "type": "string",
                              "format": "date-time",
                              "example": "2020-09-09T00:00:00"
                            },
                            "TransactionDateString": {
                              "type": "string",
                              "example": "Wednesday, September 9, 2020 12:00 AM"
                            },
                            "ReferenceID": {
                              "type": "string",
                              "example": "A20090951821"
                            },
                            "Narration": {
                              "type": "string",
                              "example": "Payment ..."
                            },
                            "Amount": {
                              "type": "number",
                              "example": 4001
                            },
                            "OpeningBalance": {
                              "type": "number",
                              "example": 64660988
                            },
                            "Balance": {
                              "type": "number",
                              "example": 64656987
                            },
                            "PostingType": {
                              "type": "string",
                              "example": "ISOPosting"
                            },
                            "Debit": {
                              "type": "string",
                              "example": "40.01"
                            },
                            "Credit": {
                              "type": "string",
                              "example": ""
                            },
                            "IsCardTransation": {
                              "type": "boolean",
                              "example": false
                            },
                            "AccountNumber": {
                              "type": "string",
                              "nullable": true,
                              "example": "1100313855"
                            },
                            "ServiceCode": {
                              "type": "string",
                              "nullable": true,
                              "example": "1203"
                            },
                            "RecordType": {
                              "type": "string",
                              "example": "Debit"
                            },
                            "ProductInfo": {
                              "type": "string",
                              "nullable": true,
                              "example": null
                            }
                          }
                        }
                      },
                      "TransactionTrackingRef": {
                        "type": "string",
                        "nullable": true,
                        "example": null
                      },
                      "Page": {
                        "type": "string",
                        "nullable": true,
                        "example": null
                      }
                    }
                  },
                  "example": {
                    "IsSuccessful": true,
                    "CustomerIDInString": null,
                    "Message": [
                      {
                        "Id": 723261,
                        "CurrentDate": "2025-07-28T13:46:32",
                        "IsReversed": false,
                        "ReversalReferenceNo": null,
                        "WithdrawableAmount": 0,
                        "UniqueIdentifier": "testdebit23",
                        "InstrumentNo": "250728134698",
                        "TransactionDate": "2020-09-09T00:00:00",
                        "TransactionDateString": "Wednesday, September 9, 2020 12:00 AM",
                        "ReferenceID": "A20090951821",
                        "Narration": "Payment ...",
                        "Amount": 4001,
                        "OpeningBalance": 64660988,
                        "Balance": 64656987,
                        "PostingType": "ISOPosting",
                        "Debit": "40.01",
                        "Credit": "",
                        "IsCardTransation": false,
                        "AccountNumber": "1100313855",
                        "ServiceCode": "1203",
                        "RecordType": "Debit",
                        "ProductInfo": null
                      }
                    ],
                    "TransactionTrackingRef": null,
                    "Page": null
                  }
                }
              }
            },
            "400": {
              "description": "Bad request - accountNumber is required",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "CustomerIDInString": {
                        "type": "string",
                        "nullable": true,
                        "example": null
                      },
                      "Message": {
                        "type": "string",
                        "example": "accountNumber is required"
                      },
                      "TransactionTrackingRef": {
                        "type": "string",
                        "nullable": true,
                        "example": null
                      },
                      "Page": {
                        "type": "string",
                        "nullable": true,
                        "example": null
                      }
                    }
                  }
                }
              }
            },
            "401": {
              "description": "Unauthorized - invalid auth token",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "Message": {
                        "type": "string",
                        "example": "Unauthorized: invalid authToken"
                      }
                    }
                  }
                }
              }
            },
            "404": {
              "description": "Account not found",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "CustomerIDInString": {
                        "type": "string",
                        "nullable": true,
                        "example": null
                      },
                      "Message": {
                        "type": "string",
                        "example": "Account not found"
                      },
                      "TransactionTrackingRef": {
                        "type": "string",
                        "nullable": true,
                        "example": null
                      },
                      "Page": {
                        "type": "string",
                        "nullable": true,
                        "example": null
                      }
                    }
                  }
                }
              }
            },
            "500": {
              "description": "Internal server error",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "CustomerIDInString": {
                        "type": "string",
                        "nullable": true,
                        "example": null
                      },
                      "Message": {
                        "type": "string",
                        "example": "Internal simulator error"
                      },
                      "TransactionTrackingRef": {
                        "type": "string",
                        "nullable": true,
                        "example": null
                      },
                      "Page": {
                        "type": "string",
                        "nullable": true,
                        "example": null
                      }
                    }
                  }
                }
              }
            },
            "503": {
              "description": "Service unavailable - CBA offline (simulated window)",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "Message": {
                        "type": "string",
                        "example": "CBA is offline (simulated window)"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/thirdpartyapiservice/apiservice/Account/AccountEnquiry": {
        "post": {
          "summary": "Account Enquiry",
          "description": "Stateful simulator endpoint that retrieves account information by NUBAN from PostgreSQL database. Returns account details with customer information. Authentication token is required in request body.",
          "tags": [
            "Account",
            "Simulator",
            "Third Party"
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": [
                    "AuthenticationCode",
                    "AccountNo"
                  ],
                  "properties": {
                    "AuthenticationCode": {
                      "type": "string",
                      "description": "Authentication token (required in body for this endpoint)",
                      "example": "617a8d1e-d292-4036-b2f2-51fdaf3dc003"
                    },
                    "AccountNo": {
                      "type": "string",
                      "description": "Account NUBAN number",
                      "example": "1100313855"
                    }
                  }
                },
                "example": {
                  "AuthenticationCode": "617a8d1e-d292-4036-b2f2-51fdaf3dc003",
                  "AccountNo": "1100313855"
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "Account found - returns account details with customer information",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "Name": {
                        "type": "string",
                        "nullable": true,
                        "example": "Samson Jabo"
                      },
                      "FirstName": {
                        "type": "string",
                        "nullable": true,
                        "example": null
                      },
                      "LastName": {
                        "type": "string",
                        "nullable": true,
                        "example": null
                      },
                      "Email": {
                        "type": "string",
                        "nullable": true,
                        "example": null
                      },
                      "PhoneNo": {
                        "type": "string",
                        "nullable": true,
                        "example": null
                      },
                      "Nuban": {
                        "type": "string",
                        "example": "1100313855"
                      },
                      "Number": {
                        "type": "string",
                        "example": "00170021010031385"
                      },
                      "ProductCode": {
                        "type": "string",
                        "example": "101"
                      },
                      "PhoneNuber": {
                        "type": "string",
                        "nullable": true,
                        "example": "1234567977"
                      },
                      "BVN": {
                        "type": "string",
                        "example": "70182881451"
                      },
                      "AvailableBalance": {
                        "type": "number",
                        "example": 64656987
                      },
                      "LedgerBalance": {
                        "type": "number",
                        "example": 64656987
                      },
                      "Status": {
                        "type": "string",
                        "example": "Active"
                      },
                      "Tier": {
                        "type": "string",
                        "example": "2"
                      },
                      "MaximumBalance": {
                        "type": "number",
                        "example": 64646987
                      },
                      "MaximumDeposit": {
                        "type": "number",
                        "example": 0
                      },
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": true
                      },
                      "ResponseMessage": {
                        "type": "string",
                        "nullable": true,
                        "example": null
                      },
                      "PNDStatus": {
                        "type": "string",
                        "example": "Active"
                      },
                      "LienStatus": {
                        "type": "string",
                        "example": "InActive"
                      },
                      "FreezeStatus": {
                        "type": "string",
                        "example": "InActive"
                      },
                      "RequestStatus": {
                        "type": "boolean",
                        "example": true
                      },
                      "ResponseDescription": {
                        "type": "string",
                        "example": "Successful"
                      },
                      "ResponseStatus": {
                        "type": "string",
                        "nullable": true,
                        "example": null
                      }
                    }
                  },
                  "example": {
                    "Name": "Samson Jabo",
                    "FirstName": null,
                    "LastName": null,
                    "Email": null,
                    "PhoneNo": null,
                    "Nuban": "1100313855",
                    "Number": "00170021010031385",
                    "ProductCode": "101",
                    "PhoneNuber": "1234567977",
                    "BVN": "70182881451",
                    "AvailableBalance": 64656987,
                    "LedgerBalance": 64656987,
                    "Status": "Active",
                    "Tier": "2",
                    "MaximumBalance": 64646987,
                    "MaximumDeposit": 0,
                    "IsSuccessful": true,
                    "ResponseMessage": null,
                    "PNDStatus": "Active",
                    "LienStatus": "InActive",
                    "FreezeStatus": "InActive",
                    "RequestStatus": true,
                    "ResponseDescription": "Successful",
                    "ResponseStatus": null
                  }
                }
              }
            },
            "400": {
              "description": "Bad request - AccountNo parameter missing",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "RequestStatus": {
                        "type": "boolean",
                        "example": false
                      },
                      "ResponseDescription": {
                        "type": "string",
                        "example": "AccountNo is required"
                      },
                      "ResponseMessage": {
                        "type": "string",
                        "example": "AccountNo is required"
                      }
                    }
                  }
                }
              }
            },
            "401": {
              "description": "Unauthorized - invalid AuthenticationCode",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "Message": {
                        "type": "string",
                        "example": "Unauthorized: invalid authToken"
                      }
                    }
                  }
                }
              }
            },
            "404": {
              "description": "Account not found for given AccountNo",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "RequestStatus": {
                        "type": "boolean",
                        "example": false
                      },
                      "ResponseDescription": {
                        "type": "string",
                        "example": "Account not found"
                      },
                      "ResponseMessage": {
                        "type": "string",
                        "example": "Account not found"
                      },
                      "Status": {
                        "type": "string",
                        "example": "NotFound"
                      }
                    }
                  }
                }
              }
            },
            "500": {
              "description": "Internal server error",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "RequestStatus": {
                        "type": "boolean",
                        "example": false
                      },
                      "ResponseDescription": {
                        "type": "string",
                        "example": "Internal simulator error"
                      },
                      "ResponseMessage": {
                        "type": "string",
                        "example": "Internal simulator error"
                      }
                    }
                  }
                }
              }
            },
            "503": {
              "description": "Service unavailable - CBA offline (simulated window)",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "Message": {
                        "type": "string",
                        "example": "CBA is offline (simulated window)"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/Account/UpdateAccountTier2": {
        "post": {
          "summary": "Update Account Tier 2",
          "description": "Stateful simulator endpoint that updates account tier and customer KYC tier. Validates BVN and CustomerID if provided. Can mark address as verified if SkipAddressVerification is true.",
          "tags": [
            "Account",
            "Simulator"
          ],
          "parameters": [
            {
              "name": "authToken",
              "in": "query",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "Authentication token",
              "example": "617a8d1e-d292-4036-b2f2-51fdaf3dc003"
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": [
                    "AccountNumber",
                    "AccountTier"
                  ],
                  "properties": {
                    "AccountNumber": {
                      "type": "string",
                      "description": "Account NUBAN number",
                      "example": "1100328682"
                    },
                    "AccountTier": {
                      "type": "string",
                      "description": "New account tier (1, 2, or 3)",
                      "example": "1",
                      "enum": [
                        "1",
                        "2",
                        "3"
                      ]
                    },
                    "SkipAddressVerification": {
                      "type": "boolean",
                      "description": "If true, marks customer address as verified",
                      "example": true
                    },
                    "BVN": {
                      "type": "string",
                      "description": "Bank Verification Number (optional, validated if provided)",
                      "example": "93540357080"
                    },
                    "CustomerID": {
                      "type": "string",
                      "description": "Customer ID (optional, validated if provided)",
                      "example": "032868000"
                    }
                  }
                },
                "example": {
                  "AccountNumber": "1100328682",
                  "AccountTier": "1",
                  "SkipAddressVerification": true,
                  "BVN": "93540357080",
                  "CustomerID": "032868000"
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "Update successful",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": true
                      },
                      "CustomerIDInString": {
                        "type": "string",
                        "nullable": true,
                        "example": "032868"
                      },
                      "Message": {
                        "type": "string",
                        "example": "Update Successful"
                      },
                      "TransactionTrackingRef": {
                        "type": "string",
                        "nullable": true,
                        "example": null
                      },
                      "Page": {
                        "type": "string",
                        "nullable": true,
                        "example": null
                      }
                    }
                  },
                  "example": {
                    "IsSuccessful": true,
                    "CustomerIDInString": "032868",
                    "Message": "Update Successful",
                    "TransactionTrackingRef": null,
                    "Page": null
                  }
                }
              }
            },
            "400": {
              "description": "Bad request - missing required fields or validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "CustomerIDInString": {
                        "type": "string",
                        "nullable": true
                      },
                      "Message": {
                        "type": "string",
                        "example": "AccountNumber is required"
                      },
                      "TransactionTrackingRef": {
                        "type": "string",
                        "nullable": true
                      },
                      "Page": {
                        "type": "string",
                        "nullable": true
                      }
                    }
                  }
                }
              }
            },
            "401": {
              "description": "Unauthorized - invalid auth token",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "Message": {
                        "type": "string",
                        "example": "Unauthorized: invalid authToken"
                      }
                    }
                  }
                }
              }
            },
            "404": {
              "description": "Account not found",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "CustomerIDInString": {
                        "type": "string",
                        "nullable": true
                      },
                      "Message": {
                        "type": "string",
                        "example": "Account not found"
                      },
                      "TransactionTrackingRef": {
                        "type": "string",
                        "nullable": true
                      },
                      "Page": {
                        "type": "string",
                        "nullable": true
                      }
                    }
                  }
                }
              }
            },
            "500": {
              "description": "Internal server error",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "CustomerIDInString": {
                        "type": "string",
                        "nullable": true
                      },
                      "Message": {
                        "type": "string",
                        "example": "Internal simulator error"
                      },
                      "TransactionTrackingRef": {
                        "type": "string",
                        "nullable": true
                      },
                      "Page": {
                        "type": "string",
                        "nullable": true
                      }
                    }
                  }
                }
              }
            },
            "503": {
              "description": "Service unavailable - CBA offline (simulated window)",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "Message": {
                        "type": "string",
                        "example": "CBA is offline (simulated window)"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/thirdpartyapiservice/apiservice/CoreTransactions/Debit": {
        "post": {
          "summary": "Debit Account",
          "description": "Stateful simulator endpoint that debits an account by decreasing ledger and available balances. Checks for sufficient funds before debiting. Implements idempotency via RetrievalReference - duplicate requests return the same response without re-debiting.",
          "tags": [
            "Transactions",
            "Simulator",
            "Third Party"
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": [
                    "RetrievalReference",
                    "AccountNumber",
                    "Amount"
                  ],
                  "properties": {
                    "RetrievalReference": {
                      "type": "string",
                      "description": "Unique retrieval reference for idempotency",
                      "example": "testdebit23"
                    },
                    "AccountNumber": {
                      "type": "string",
                      "description": "Account NUBAN number to debit",
                      "example": "1100327049"
                    },
                    "Amount": {
                      "type": "string",
                      "description": "Amount to debit (positive number)",
                      "example": "59945"
                    },
                    "Narration": {
                      "type": "string",
                      "description": "Transaction narration (optional)",
                      "example": "Paan shop"
                    },
                    "Token": {
                      "type": "string",
                      "description": "Authentication token (optional, can also be in query)",
                      "example": "617a8d1e-d292-4036-b2f2-51fdaf3dc003"
                    }
                  }
                },
                "example": {
                  "RetrievalReference": "testdebit23",
                  "AccountNumber": "1100327049",
                  "Amount": "59945",
                  "Narration": "Paan shop",
                  "Token": "617a8d1e-d292-4036-b2f2-51fdaf3dc003"
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "Debit successful or failed (insufficient funds)",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": true
                      },
                      "ResponseMessage": {
                        "type": "string",
                        "example": "Approved by Financial Institution"
                      },
                      "ResponseCode": {
                        "type": "string",
                        "example": "00"
                      },
                      "Reference": {
                        "type": "string",
                        "example": "A20090953189"
                      }
                    }
                  },
                  "examples": {
                    "success": {
                      "value": {
                        "IsSuccessful": true,
                        "ResponseMessage": "Approved by Financial Institution",
                        "ResponseCode": "00",
                        "Reference": "A20090953189"
                      }
                    },
                    "insufficientFunds": {
                      "value": {
                        "IsSuccessful": false,
                        "ResponseMessage": "Insufficient funds",
                        "ResponseCode": "51",
                        "Reference": "A20090953189"
                      }
                    }
                  }
                }
              }
            },
            "400": {
              "description": "Bad request - missing required fields or invalid amount",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "ResponseMessage": {
                        "type": "string",
                        "example": "RetrievalReference is required"
                      },
                      "ResponseCode": {
                        "type": "string",
                        "example": "96"
                      },
                      "Reference": {
                        "type": "string",
                        "nullable": true,
                        "example": null
                      }
                    }
                  }
                }
              }
            },
            "401": {
              "description": "Unauthorized - invalid auth token",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "ResponseMessage": {
                        "type": "string",
                        "example": "Unauthorized: invalid authToken"
                      },
                      "ResponseCode": {
                        "type": "string",
                        "example": "96"
                      },
                      "Reference": {
                        "type": "string",
                        "nullable": true,
                        "example": null
                      }
                    }
                  }
                }
              }
            },
            "404": {
              "description": "Account not found",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "ResponseMessage": {
                        "type": "string",
                        "example": "Account not found"
                      },
                      "ResponseCode": {
                        "type": "string",
                        "example": "14"
                      },
                      "Reference": {
                        "type": "string",
                        "example": "A20090953189"
                      }
                    }
                  }
                }
              }
            },
            "500": {
              "description": "Internal server error",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "ResponseMessage": {
                        "type": "string",
                        "example": "Internal simulator error"
                      },
                      "ResponseCode": {
                        "type": "string",
                        "example": "96"
                      },
                      "Reference": {
                        "type": "string",
                        "nullable": true,
                        "example": null
                      }
                    }
                  }
                }
              }
            },
            "503": {
              "description": "Service unavailable - CBA offline (simulated window)",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "Message": {
                        "type": "string",
                        "example": "CBA is offline (simulated window)"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/thirdpartyapiservice/apiservice/CoreTransactions/LocalFundsTransfer": {
        "post": {
          "summary": "Local Funds Transfer",
          "description": "Stateful simulator endpoint that transfers funds between two accounts atomically. Debits the FROM account and credits the TO account in a single database transaction. Checks for sufficient funds before transferring. Implements idempotency via RetrievalReference - duplicate requests return the same response without re-applying the transfer.",
          "tags": [
            "Transactions",
            "Simulator",
            "Third Party"
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": [
                    "FromAccountNumber",
                    "ToAccountNumber",
                    "Amount",
                    "RetrievalReference"
                  ],
                  "properties": {
                    "FromAccountNumber": {
                      "type": "string",
                      "description": "Source account NUBAN number",
                      "example": "1100322161"
                    },
                    "ToAccountNumber": {
                      "type": "string",
                      "description": "Destination account NUBAN number",
                      "example": "1100314089"
                    },
                    "Amount": {
                      "type": "string",
                      "description": "Amount to transfer (positive number)",
                      "example": "100"
                    },
                    "RetrievalReference": {
                      "type": "string",
                      "description": "Unique retrieval reference for idempotency",
                      "example": "100228yui12"
                    },
                    "Narration": {
                      "type": "string",
                      "description": "Transaction narration (optional)",
                      "example": "Local funds transfer"
                    },
                    "AuthenticationKey": {
                      "type": "string",
                      "description": "Authentication token (optional, can also be in query)",
                      "example": "617a8d1e-d292-4036-b2f2-51fdaf3dc003"
                    }
                  }
                },
                "example": {
                  "FromAccountNumber": "1100322161",
                  "Amount": "100",
                  "ToAccountNumber": "1100314089",
                  "RetrievalReference": "100228yui12",
                  "Narration": "Local funds transfer",
                  "AuthenticationKey": "617a8d1e-d292-4036-b2f2-51fdaf3dc003"
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "Transfer successful or failed (insufficient funds, account inactive)",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": true
                      },
                      "ResponseMessage": {
                        "type": "string",
                        "example": "Approved by Financial Institution"
                      },
                      "ResponseCode": {
                        "type": "string",
                        "example": "00"
                      },
                      "Reference": {
                        "type": "string",
                        "example": "A20090953185"
                      }
                    }
                  },
                  "examples": {
                    "success": {
                      "value": {
                        "IsSuccessful": true,
                        "ResponseMessage": "Approved by Financial Institution",
                        "ResponseCode": "00",
                        "Reference": "A20090953185"
                      }
                    },
                    "insufficientFunds": {
                      "value": {
                        "IsSuccessful": false,
                        "ResponseMessage": "Insufficient funds",
                        "ResponseCode": "51",
                        "Reference": "A20090953185"
                      }
                    },
                    "accountInactive": {
                      "value": {
                        "IsSuccessful": false,
                        "ResponseMessage": "Transaction not permitted on this account",
                        "ResponseCode": "57",
                        "Reference": "A20090953185"
                      }
                    }
                  }
                }
              }
            },
            "400": {
              "description": "Bad request - missing required fields, invalid amount, or same from/to accounts",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "ResponseMessage": {
                        "type": "string",
                        "example": "RetrievalReference is required"
                      },
                      "ResponseCode": {
                        "type": "string",
                        "example": "96"
                      },
                      "Reference": {
                        "type": "string",
                        "nullable": true,
                        "example": null
                      }
                    }
                  }
                }
              }
            },
            "401": {
              "description": "Unauthorized - invalid auth token",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "ResponseMessage": {
                        "type": "string",
                        "example": "Unauthorized: invalid authToken"
                      },
                      "ResponseCode": {
                        "type": "string",
                        "example": "96"
                      },
                      "Reference": {
                        "type": "string",
                        "nullable": true,
                        "example": null
                      }
                    }
                  }
                }
              }
            },
            "404": {
              "description": "Account not found",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "ResponseMessage": {
                        "type": "string",
                        "example": "Account not found"
                      },
                      "ResponseCode": {
                        "type": "string",
                        "example": "14"
                      },
                      "Reference": {
                        "type": "string",
                        "example": "A20090953185"
                      }
                    }
                  }
                }
              }
            },
            "500": {
              "description": "Internal server error",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "ResponseMessage": {
                        "type": "string",
                        "example": "Internal simulator error"
                      },
                      "ResponseCode": {
                        "type": "string",
                        "example": "96"
                      },
                      "Reference": {
                        "type": "string",
                        "nullable": true,
                        "example": null
                      }
                    }
                  }
                }
              }
            },
            "503": {
              "description": "Service unavailable - CBA offline (simulated window)",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "Message": {
                        "type": "string",
                        "example": "CBA is offline (simulated window)"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/thirdpartyapiservice/apiservice/CoreTransactions/Credit": {
        "post": {
          "summary": "Credit Account",
          "description": "Stateful simulator endpoint that credits an account by increasing ledger and available balances. Implements idempotency via RetrievalReference - duplicate requests return the same response without re-crediting.",
          "tags": [
            "Transactions",
            "Simulator",
            "Third Party"
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": [
                    "RetrievalReference",
                    "AccountNumber",
                    "Amount"
                  ],
                  "properties": {
                    "RetrievalReference": {
                      "type": "string",
                      "description": "Unique retrieval reference for idempotency",
                      "example": "testcred055"
                    },
                    "AccountNumber": {
                      "type": "string",
                      "description": "Account NUBAN number to credit",
                      "example": "1100332209"
                    },
                    "Amount": {
                      "type": "string",
                      "description": "Amount to credit (positive number)",
                      "example": "1000000"
                    },
                    "Narration": {
                      "type": "string",
                      "description": "Transaction narration (optional)",
                      "example": "test credit 1"
                    },
                    "Token": {
                      "type": "string",
                      "description": "Authentication token (optional, can also be in query)",
                      "example": "617a8d1e-d292-4036-b2f2-51fdaf3dc003"
                    }
                  }
                },
                "example": {
                  "RetrievalReference": "testcred055",
                  "AccountNumber": "1100332209",
                  "Amount": "1000000",
                  "Narration": "test credit 1",
                  "Token": "617a8d1e-d292-4036-b2f2-51fdaf3dc003"
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "Credit successful",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": true
                      },
                      "ResponseMessage": {
                        "type": "string",
                        "example": "Approved by Financial Institution"
                      },
                      "ResponseCode": {
                        "type": "string",
                        "example": "00"
                      },
                      "Reference": {
                        "type": "string",
                        "example": "A20090953187"
                      }
                    }
                  },
                  "example": {
                    "IsSuccessful": true,
                    "ResponseMessage": "Approved by Financial Institution",
                    "ResponseCode": "00",
                    "Reference": "A20090953187"
                  }
                }
              }
            },
            "400": {
              "description": "Bad request - missing required fields or invalid amount",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "ResponseMessage": {
                        "type": "string",
                        "example": "RetrievalReference is required"
                      },
                      "ResponseCode": {
                        "type": "string",
                        "example": "96"
                      },
                      "Reference": {
                        "type": "string",
                        "nullable": true,
                        "example": null
                      }
                    }
                  }
                }
              }
            },
            "401": {
              "description": "Unauthorized - invalid auth token",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "ResponseMessage": {
                        "type": "string",
                        "example": "Unauthorized: invalid authToken"
                      },
                      "ResponseCode": {
                        "type": "string",
                        "example": "96"
                      },
                      "Reference": {
                        "type": "string",
                        "nullable": true,
                        "example": null
                      }
                    }
                  }
                }
              }
            },
            "404": {
              "description": "Account not found",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "ResponseMessage": {
                        "type": "string",
                        "example": "Account not found"
                      },
                      "ResponseCode": {
                        "type": "string",
                        "example": "14"
                      },
                      "Reference": {
                        "type": "string",
                        "example": "A20090953187"
                      }
                    }
                  }
                }
              }
            },
            "500": {
              "description": "Internal server error",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "ResponseMessage": {
                        "type": "string",
                        "example": "Internal simulator error"
                      },
                      "ResponseCode": {
                        "type": "string",
                        "example": "96"
                      },
                      "Reference": {
                        "type": "string",
                        "nullable": true,
                        "example": null
                      }
                    }
                  }
                }
              }
            },
            "503": {
              "description": "Service unavailable - CBA offline (simulated window)",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "Message": {
                        "type": "string",
                        "example": "CBA is offline (simulated window)"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/Account/CreateCustomerAndAccount": {
        "post": {
          "summary": "Create Customer And Account",
          "description": "Stateful simulator endpoint that creates a new customer and account in the database. Supports idempotency via TransactionTrackingRef.",
          "tags": [
            "Account",
            "Simulator"
          ],
          "parameters": [
            {
              "name": "authToken",
              "in": "query",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "Authentication token",
              "example": "617a8d1e-d292-4036-b2f2-51fdaf3dc003"
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": [
                    "TransactionTrackingRef",
                    "ProductCode",
                    "PhoneNo",
                    "BVN",
                    "LastName",
                    "OtherNames"
                  ],
                  "properties": {
                    "TransactionTrackingRef": {
                      "type": "string",
                      "description": "Unique transaction tracking reference for idempotency",
                      "example": "TXN-001-2024-12-04"
                    },
                    "ProductCode": {
                      "type": "string",
                      "description": "Product code for the account (e.g., SAVINGS, CURRENT)",
                      "example": "SAVINGS"
                    },
                    "PhoneNo": {
                      "type": "string",
                      "description": "Customer phone number",
                      "example": "9988770011"
                    },
                    "BVN": {
                      "type": "string",
                      "description": "Bank Verification Number",
                      "example": "12345678901"
                    },
                    "LastName": {
                      "type": "string",
                      "description": "Customer last name",
                      "example": "Doe"
                    },
                    "OtherNames": {
                      "type": "string",
                      "description": "Customer first name and other names",
                      "example": "John"
                    },
                    "Email": {
                      "type": "string",
                      "format": "email",
                      "description": "Customer email address (optional)",
                      "example": "john.doe@example.com"
                    },
                    "Gender": {
                      "type": "string",
                      "description": "Customer gender (optional). Accepts \"Male\" or \"Female\" - will be stored as \"0\" (Male) or \"1\" (Female) in database",
                      "example": "Male",
                      "enum": [
                        "Male",
                        "Female",
                        "male",
                        "female",
                        "M",
                        "F"
                      ]
                    },
                    "DOB": {
                      "type": "string",
                      "format": "date",
                      "description": "Date of birth in YYYY-MM-DD format (optional)",
                      "example": "1990-01-15"
                    },
                    "Address": {
                      "type": "string",
                      "description": "Customer address (optional)",
                      "example": "123 Main Street, City, State"
                    },
                    "NationalID": {
                      "type": "string",
                      "description": "National ID number (optional)",
                      "example": "NIN123456"
                    },
                    "AccountTier": {
                      "type": "string",
                      "description": "Account tier: Tier1, Tier2, or Tier3 (optional, defaults to Tier1)",
                      "example": "Tier1",
                      "enum": [
                        "Tier1",
                        "Tier2",
                        "Tier3"
                      ]
                    }
                  }
                },
                "example": {
                  "TransactionTrackingRef": "TXN-001-2024-12-04",
                  "ProductCode": "SAVINGS",
                  "PhoneNo": "9988770011",
                  "BVN": "12345678901",
                  "LastName": "Doe",
                  "OtherNames": "John",
                  "Email": "john.doe@example.com",
                  "Gender": "Male",
                  "DOB": "1990-01-15",
                  "Address": "123 Main Street",
                  "NationalID": "NIN123456",
                  "AccountTier": "Tier1"
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "Customer and account created successfully",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": true
                      },
                      "CustomerIDInString": {
                        "type": "string",
                        "example": "000001"
                      },
                      "Message": {
                        "type": "string",
                        "example": "Individual Customer and account Created successfully."
                      },
                      "TransactionTrackingRef": {
                        "type": "string",
                        "example": "TXN-001-2024-12-04"
                      },
                      "Page": {
                        "type": "null",
                        "example": null
                      }
                    }
                  },
                  "example": {
                    "IsSuccessful": true,
                    "CustomerIDInString": "000001",
                    "Message": "Individual Customer and account Created successfully.",
                    "TransactionTrackingRef": "TXN-001-2024-12-04",
                    "Page": null
                  }
                }
              }
            },
            "400": {
              "description": "Validation error - missing required fields",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "Message": {
                        "type": "string",
                        "example": "Validation failed: TransactionTrackingRef is required"
                      },
                      "TransactionTrackingRef": {
                        "type": "string",
                        "nullable": true
                      },
                      "Page": {
                        "type": "null",
                        "example": null
                      }
                    }
                  }
                }
              }
            },
            "401": {
              "description": "Unauthorized - invalid auth token",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "Message": {
                        "type": "string",
                        "example": "Unauthorized: invalid authToken"
                      }
                    }
                  }
                }
              }
            },
            "500": {
              "description": "Server error",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "Message": {
                        "type": "string",
                        "example": "Failed to create customer and account: Error message"
                      },
                      "TransactionTrackingRef": {
                        "type": "string",
                        "nullable": true
                      },
                      "Page": {
                        "type": "null",
                        "example": null
                      }
                    }
                  }
                }
              }
            },
            "503": {
              "description": "Service unavailable - CBA offline (simulated window)",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "IsSuccessful": {
                        "type": "boolean",
                        "example": false
                      },
                      "Message": {
                        "type": "string",
                        "example": "CBA is offline (simulated window)"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  "customOptions": {}
};
  url = options.swaggerUrl || url
  var urls = options.swaggerUrls
  var customOptions = options.customOptions
  var spec1 = options.swaggerDoc
  var swaggerOptions = {
    spec: spec1,
    url: url,
    urls: urls,
    dom_id: '#swagger-ui',
    deepLinking: true,
    presets: [
      SwaggerUIBundle.presets.apis,
      SwaggerUIStandalonePreset
    ],
    plugins: [
      SwaggerUIBundle.plugins.DownloadUrl
    ],
    layout: "StandaloneLayout"
  }
  for (var attrname in customOptions) {
    swaggerOptions[attrname] = customOptions[attrname];
  }
  var ui = SwaggerUIBundle(swaggerOptions)

  if (customOptions.oauth) {
    ui.initOAuth(customOptions.oauth)
  }

  if (customOptions.preauthorizeApiKey) {
    const key = customOptions.preauthorizeApiKey.authDefinitionKey;
    const value = customOptions.preauthorizeApiKey.apiKeyValue;
    if (!!key && !!value) {
      const pid = setInterval(() => {
        const authorized = ui.preauthorizeApiKey(key, value);
        if(!!authorized) clearInterval(pid);
      }, 500)

    }
  }

  if (customOptions.authAction) {
    ui.authActions.authorize(customOptions.authAction)
  }

  window.ui = ui
}
