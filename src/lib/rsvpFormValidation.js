import { sanitizeEditCodeInput } from './signupApi.js'

function validEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

function phoneDigitsOk(phone) {
  return phone.replace(/\D/g, '').length >= 7
}

/**
 * @param {string} codeInput
 * @returns {{ editCode: string, errors: Record<string, string>, valid: boolean }}
 */
export function validateGateCode(codeInput) {
  const editCode = sanitizeEditCodeInput(codeInput)
  /** @type {Record<string, string>} */
  const errors = {}

  if (!editCode) {
    errors.editCode = 'Enter your 4-digit RSVP code.'
  } else if (editCode.length < 4) {
    errors.editCode = 'RSVP code must be 4 digits.'
  }

  return { editCode, errors, valid: Object.keys(errors).length === 0 }
}

/**
 * @param {{
 *   fullName: string
 *   email: string
 *   phone: string
 *   heardAbout: string
 *   primaryContact: 'email' | 'phone' | null
 *   episodeReady: boolean
 * }} fields
 */
export function validateNewRsvpForm(fields) {
  /** @type {Record<string, string>} */
  const errors = {}

  if (!fields.fullName.trim()) {
    errors.fullName = 'Name is required.'
  }

  if (!fields.email.trim()) {
    errors.email = 'Email is required.'
  } else if (!validEmail(fields.email)) {
    errors.email = 'Enter a valid email address.'
  }

  if (!fields.phone.trim()) {
    errors.phone = 'Phone number is required.'
  } else if (!phoneDigitsOk(fields.phone)) {
    errors.phone = 'Enter a valid phone number (at least 7 digits).'
  }

  if (!fields.heardAbout.trim()) {
    errors.heardAbout = 'Please tell us how you heard about Sunday Sunset Sessions.'
  }

  if (fields.primaryContact !== 'email' && fields.primaryContact !== 'phone') {
    errors.primaryContact = 'Select email or phone as your primary contact for address details.'
  }

  if (!fields.episodeReady) {
    errors.form = 'This event is not open for RSVPs yet. Please try again later.'
  }

  return { errors, valid: Object.keys(errors).length === 0 }
}

/**
 * @param {{
 *   fullName: string
 *   email: string
 *   phone: string
 *   primaryContact: 'email' | 'phone' | null
 * }} fields
 */
export function validateProfileForm(fields) {
  /** @type {Record<string, string>} */
  const errors = {}

  if (!fields.fullName.trim()) {
    errors.fullName = 'Name is required.'
  }

  if (!fields.email.trim()) {
    errors.email = 'Email is required.'
  } else if (!validEmail(fields.email)) {
    errors.email = 'Enter a valid email address.'
  }

  if (!fields.phone.trim()) {
    errors.phone = 'Phone number is required.'
  } else if (!phoneDigitsOk(fields.phone)) {
    errors.phone = 'Enter a valid phone number (at least 7 digits).'
  }

  if (fields.primaryContact !== 'email' && fields.primaryContact !== 'phone') {
    errors.primaryContact = 'Select email or phone as your primary contact for address details.'
  }

  return { errors, valid: Object.keys(errors).length === 0 }
}
