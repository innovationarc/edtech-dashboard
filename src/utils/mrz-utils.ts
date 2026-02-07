// src/utils/mrz-utils.ts - MRZ Generator & Validator for ID Cards

/**
 * MRZ (Machine Readable Zone) Generator & Validator
 * Implements ICAO Document 9303 standard for ID cards
 */

// Character value mapping for check digit calculation
const MRZ_CHAR_VALUES: { [key: string]: number } = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'A': 10, 'B': 11, 'C': 12, 'D': 13, 'E': 14, 'F': 15, 'G': 16, 'H': 17, 'I': 18,
  'J': 19, 'K': 20, 'L': 21, 'M': 22, 'N': 23, 'O': 24, 'P': 25, 'Q': 26, 'R': 27,
  'S': 28, 'T': 29, 'U': 30, 'V': 31, 'W': 32, 'X': 33, 'Y': 34, 'Z': 35, '<': 0
};

const WEIGHTS = [7, 3, 1]; // ICAO standard weights

/**
 * Calculate check digit per ICAO standard
 */
function calculateCheckDigit(input: string): string {
  let sum = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input[i].toUpperCase();
    const value = MRZ_CHAR_VALUES[char] ?? 0;
    const weight = WEIGHTS[i % 3];
    sum += value * weight;
  }
  return (sum % 10).toString();
}

/**
 * Sanitize name: uppercase, replace spaces with '<', remove special chars
 */
function sanitizeName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z\s]/g, '') // Remove non-alphabetic chars
    .replace(/\s+/g, '<');     // Replace spaces with '<'
}

/**
 * Pad string with '<' to specified length
 */
function padWithFillers(str: string, length: number): string {
  if (str.length >= length) {
    return str.substring(0, length);
  }
  return str + '<'.repeat(length - str.length);
}

/**
 * Format date to YYMMDD
 */
function formatDateToYYMMDD(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const yy = d.getFullYear().toString().slice(-2);
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const dd = d.getDate().toString().padStart(2, '0');
  return yy + mm + dd;
}

/**
 * Extract userId without dashes
 */
function sanitizeUserId(userId: string): string {
  return userId.replace(/-/g, '').toUpperCase();
}

export interface MRZData {
  userId: string;
  fullName: string;
  surname: string;
  name?: string;
  middleName?: string;
  dob: Date | string;
  issueDate: Date | string;
  expiryDate?: Date | string | 'lifetime';
}

export interface GeneratedMRZ {
  line1: string;
  line2: string;
  isValid: boolean;
}

/**
 * Generate MRZ lines for ID card
 * 
 * Line 1 Format (44 chars): SURNAME<MIDDLE<FIRST<<<<<<<<<<<<<<<<<<<<<<<<
 * Line 2 Format (44 chars): USERID<C<YYMMDD<C<YYMMDD<C<YYMMDD<C or <<<<<<
 * 
 * Where C is check digit
 */
export function generateMRZ(data: MRZData): GeneratedMRZ {
  try {
    // Parse names
    const surname = sanitizeName(data.surname || '');
    const firstName = sanitizeName(data.name || '');
    const middleName = sanitizeName(data.middleName || '');
    
    // Line 1: Name (44 characters)
    let namePart = surname;
    if (firstName) {
      namePart += '<' + firstName;
    }
    if (middleName) {
      namePart += '<' + middleName;
    }
    const line1 = padWithFillers(namePart, 44);

    // Line 2: ID, DOB, Issue, Expiry with check digits
    const userIdClean = sanitizeUserId(data.userId);
    const userIdPart = padWithFillers(userIdClean, 14); // Pad to 14 chars
    const userIdCheck = calculateCheckDigit(userIdClean);

    const dobFormatted = formatDateToYYMMDD(data.dob);
    const dobCheck = calculateCheckDigit(dobFormatted);

    const issueFormatted = formatDateToYYMMDD(data.issueDate);
    const issueCheck = calculateCheckDigit(issueFormatted);

    let expiryPart = '';
    let expiryCheck = '';
    
    if (data.expiryDate === 'lifetime' || !data.expiryDate) {
      expiryPart = '<<<<<<'; // 6 fillers for lifetime
      expiryCheck = calculateCheckDigit('<<<<<<');
    } else {
      expiryPart = formatDateToYYMMDD(data.expiryDate);
      expiryCheck = calculateCheckDigit(expiryPart);
    }

    // Build Line 2: USERID<C<DOB<C<ISSUE<C<EXPIRY<C
    const line2Parts = [
      userIdPart,
      userIdCheck,
      '<',
      dobFormatted,
      dobCheck,
      '<',
      issueFormatted,
      issueCheck,
      '<',
      expiryPart,
      expiryCheck
    ];
    
    let line2 = line2Parts.join('');
    
    // Pad to 44 characters
    line2 = padWithFillers(line2, 44);

    return {
      line1,
      line2,
      isValid: true
    };
  } catch (error) {
    console.error('MRZ Generation Error:', error);
    return {
      line1: '<'.repeat(44),
      line2: '<'.repeat(44),
      isValid: false
    };
  }
}

export interface MRZValidationResult {
  isValid: boolean;
  errors: string[];
  extractedData?: {
    userId: string;
    surname: string;
    firstName: string;
    middleName: string;
    dob: string;
    issueDate: string;
    expiryDate: string | 'lifetime';
  };
}

/**
 * Validate MRZ lines and extract data
 */
export function validateMRZ(line1: string, line2: string): MRZValidationResult {
  const errors: string[] = [];

  // Check line lengths
  if (line1.length !== 44) {
    errors.push(`Line 1 must be 44 characters (got ${line1.length})`);
  }
  if (line2.length !== 44) {
    errors.push(`Line 2 must be 44 characters (got ${line2.length})`);
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // Validate characters (only A-Z, 0-9, <)
  const validChars = /^[A-Z0-9<]+$/;
  if (!validChars.test(line1)) {
    errors.push('Line 1 contains invalid characters');
  }
  if (!validChars.test(line2)) {
    errors.push('Line 2 contains invalid characters');
  }

  try {
    // Parse Line 1 (Name)
    const nameParts = line1.replace(/</g, ' ').trim().split(/\s+/);
    const surname = nameParts[0] || '';
    const firstName = nameParts[1] || '';
    const middleName = nameParts[2] || '';

    // Parse Line 2
    // Expected format: USERID<C<DOB<C<ISSUE<C<EXPIRY<C<<<...
    let idx = 0;
    
    // Extract userId (up to first check digit position)
    const userIdEndIdx = line2.indexOf('<', idx);
    const userIdField = line2.substring(idx, userIdEndIdx).replace(/</g, '');
    idx = userIdEndIdx + 1;
    
    const userIdCheckDigit = line2[idx];
    idx += 2; // Skip check digit and separator

    // Validate userId check digit
    const calculatedUserIdCheck = calculateCheckDigit(userIdField);
    if (userIdCheckDigit !== calculatedUserIdCheck) {
      errors.push('Invalid userId check digit');
    }

    // Extract DOB
    const dobField = line2.substring(idx, idx + 6);
    idx += 6;
    const dobCheckDigit = line2[idx];
    idx += 2;

    const calculatedDobCheck = calculateCheckDigit(dobField);
    if (dobCheckDigit !== calculatedDobCheck) {
      errors.push('Invalid DOB check digit');
    }

    // Extract Issue Date
    const issueField = line2.substring(idx, idx + 6);
    idx += 6;
    const issueCheckDigit = line2[idx];
    idx += 2;

    const calculatedIssueCheck = calculateCheckDigit(issueField);
    if (issueCheckDigit !== calculatedIssueCheck) {
      errors.push('Invalid issue date check digit');
    }

    // Extract Expiry
    const expiryField = line2.substring(idx, idx + 6);
    idx += 6;
    const expiryCheckDigit = line2[idx];

    let expiryDate: string | 'lifetime' = 'lifetime';
    
    if (expiryField === '<<<<<<') {
      expiryDate = 'lifetime';
      // Validate lifetime check digit
      const calculatedExpiryCheck = calculateCheckDigit('<<<<<<');
      if (expiryCheckDigit !== calculatedExpiryCheck) {
        errors.push('Invalid expiry check digit (lifetime)');
      }
    } else {
      expiryDate = expiryField;
      const calculatedExpiryCheck = calculateCheckDigit(expiryField);
      if (expiryCheckDigit !== calculatedExpiryCheck) {
        errors.push('Invalid expiry check digit');
      }

      // Validate expiry date is not in the past (unless lifetime)
      const now = new Date();
      const expYear = 2000 + parseInt(expiryField.substring(0, 2));
      const expMonth = parseInt(expiryField.substring(2, 4)) - 1;
      const expDay = parseInt(expiryField.substring(4, 6));
      const expiryDateObj = new Date(expYear, expMonth, expDay);
      
      if (expiryDateObj < now) {
        errors.push('ID card has expired');
      }
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    return {
      isValid: true,
      errors: [],
      extractedData: {
        userId: userIdField,
        surname,
        firstName,
        middleName,
        dob: dobField,
        issueDate: issueField,
        expiryDate
      }
    };
  } catch (error) {
    errors.push('Failed to parse MRZ data');
    return { isValid: false, errors };
  }
}

/**
 * Extract userId from MRZ (for quick lookup)
 */
export function extractUserIdFromMRZ(line2: string): string | null {
  try {
    const userIdEndIdx = line2.indexOf('<');
    const userId = line2.substring(0, userIdEndIdx).replace(/</g, '');
    return userId || null;
  } catch {
    return null;
  }
}
