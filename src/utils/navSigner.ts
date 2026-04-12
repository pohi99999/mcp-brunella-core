import crypto from 'crypto';

/**
 * NAV Online Számla API v3.0 Signer Utility
 */

/**
 * Formats a Date object to the NAV signature timestamp format: YYYYMMDDHHmmss
 * @param date The date to format (defaults to current date)
 * @returns Masked timestamp string
 */
export function getNavTimestamp(date: Date = new Date()): string {
  return date.toISOString()
    .replace(/[-:T]/g, '')
    .split('.')[0];
}

/**
 * Calculates the SHA-512 hash for the technical user password.
 * @param password Technical user password
 * @returns Uppercase hex hash
 */
export function calculatePasswordHash(password: string): string {
  return crypto.createHash('sha512')
    .update(password)
    .digest('hex')
    .toUpperCase();
}

/**
 * Calculates the SHA3-512 requestSignature for simple API requests.
 * Formula: SHA3-512(requestId + timestamp + signatureKey)
 * 
 * @param requestId Unique request identifier
 * @param timestamp Masked timestamp (YYYYMMDDHHmmss)
 * @param signatureKey XML signature key from NAV portal
 * @returns Uppercase hex hash
 */
export function calculateRequestSignature(
  requestId: string,
  timestamp: string,
  signatureKey: string
): string {
  const concatString = requestId + timestamp + signatureKey;
  
  return crypto.createHash('sha3-512')
    .update(concatString)
    .digest('hex')
    .toUpperCase();
}

/**
 * Calculates the SHA3-512 requestSignature for manageInvoice requests.
 * Formula: SHA3-512(requestId + timestamp + signatureKey + cumulativeHash)
 * 
 * @param requestId Unique request identifier
 * @param timestamp Masked timestamp (YYYYMMDDHHmmss)
 * @param signatureKey XML signature key from NAV portal
 * @param cumulativeHash SHA3-512 hash of concatenated operation hashes
 * @returns Uppercase hex hash
 */
export function calculateManageInvoiceSignature(
  requestId: string,
  timestamp: string,
  signatureKey: string,
  cumulativeHash: string
): string {
  const concatString = requestId + timestamp + signatureKey + cumulativeHash;
  
  return crypto.createHash('sha3-512')
    .update(concatString)
    .digest('hex')
    .toUpperCase();
}

/**
 * Calculates cumulative hash for multiple invoice operations.
 * 
 * @param operations Array of objects with operation type and base64 encoded XML data
 * @returns Uppercase hex cumulative hash
 */
export function calculateCumulativeHash(
  operations: Array<{ op: string; data: string }>
): string {
  // 1. Calculate hash for each operation: SHA3-512(operation + base64Data)
  const opHashes = operations.map(item => {
    return crypto.createHash('sha3-512')
      .update(item.op + item.data)
      .digest('hex')
      .toUpperCase();
  });

  // 2. Concatenate all operation hashes and hash the result
  return crypto.createHash('sha3-512')
    .update(opHashes.join(''))
    .digest('hex')
    .toUpperCase();
}
