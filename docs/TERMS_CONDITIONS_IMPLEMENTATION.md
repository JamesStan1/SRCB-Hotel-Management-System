# Terms and Conditions Implementation Guide

## Overview
This document details the implementation of scroll-to-enable Terms and Conditions acceptance in the homepage reservation forms (Room Reservation and Event Reservation).

## Implementation Date
January 2025

## Affected Files
1. `app/reservations/room/page.js` - Room Reservation Form (Homepage)
2. `app/reservations/event/page.js` - Event Reservation Form (Homepage)

---

## Features Implemented

### 1. Scroll Detection Mechanism
- **Purpose**: Ensures users read the entire Terms and Conditions before accepting
- **Mechanism**: Checkbox remains disabled until user scrolls to the bottom of the T&C section
- **Technology**: React useRef and onScroll event handler

### 2. State Management
Three new state variables per form:
```javascript
const [termsAccepted, setTermsAccepted] = useState(false);   // Tracks checkbox state
const [termsScrolled, setTermsScrolled] = useState(false);   // Tracks scroll completion
const termsRef = useRef(null);                                // Reference to scrollable div
```

### 3. Scroll Detection Logic
```javascript
const handleTermsScroll = (e) => {
  const element = e.target;
  const scrolledToBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 5;
  if (scrolledToBottom) {
    setTermsScrolled(true);
  }
};
```
- **Calculation**: `scrollHeight - scrollTop <= clientHeight + 5`
- **Tolerance**: 5px buffer to account for rounding differences
- **Trigger**: Sets `termsScrolled` to true when bottom is reached

### 4. Form Validation
Added validation before form submission:
```javascript
if (!termsAccepted) {
  await Swal.fire({
    icon: 'warning',
    title: 'Terms and Conditions Required',
    text: 'Please read and accept the Terms and Conditions to continue.',
    confirmButtonColor: '#f59e0b'
  });
  setSubmitting(false);
  return;
}
```
- **Position**: After `e.preventDefault()` and before existing field validations
- **Behavior**: Blocks submission with user-friendly warning message
- **UI**: SweetAlert2 modal with amber/warning color scheme

### 5. Form Reset Logic
Terms state is reset in two scenarios:

**Scenario A: Successful Submission**
```javascript
// Reset terms state after successful submission
setTermsAccepted(false);
setTermsScrolled(false);
```

**Scenario B: Reset Button Clicked**
```javascript
// Added to existing Reset button handler
setTermsAccepted(false);
setTermsScrolled(false);
```

---

## UI Components

### Scrollable Terms Container
- **Height**: `h-64` (256px / 16rem)
- **Overflow**: `overflow-y-scroll` (always shows scrollbar)
- **Border**: Amber border with light amber background
- **Styling**: White content background with gray text for readability

### Terms Content Structure
The Terms and Conditions include 6 sections:

1. **Valid Identification Required**
   - Requirement for government-issued ID
   - Types of acceptable IDs (Driver's License, Passport, National ID)
   - Purpose: Verification upon check-in

2. **Identity Verification**
   - Management's right to verify ID authenticity
   - Consequences of invalid/fake IDs (cancellation without refund)

3. **Check-In Verification**
   - Physical ID must match uploaded document
   - Person checking in must be the reservation holder
   - Third-party check-in restrictions

4. **Data Protection and Privacy**
   - Purpose of data collection (reservation and security)
   - Compliance with data protection regulations
   - No third-party sharing without consent (except legal requirements)

5. **Fraud Prevention**
   - Prohibition of fake/altered IDs
   - Consequences (cancellation, denial, legal action)
   - Record retention for security and audits

6. **Agreement and Acknowledgment**
   - User acknowledgment of reading and understanding
   - Confirmation of information accuracy
   - Verification of ID document authenticity

### Checkbox Component
```jsx
<input
  type="checkbox"
  id="termsCheckbox"
  checked={termsAccepted}
  onChange={(e) => setTermsAccepted(e.target.checked)}
  disabled={!termsScrolled}
  className="mt-1 h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
/>
<label htmlFor="termsCheckbox" className="text-sm text-gray-700 cursor-pointer">
  I have read and agree to the Terms and Conditions regarding ID verification and data privacy.
</label>
```

**Attributes**:
- `disabled={!termsScrolled}`: Checkbox only enabled after scrolling
- `checked={termsAccepted}`: Controlled component linked to state
- `cursor-pointer` / `disabled:cursor-not-allowed`: Visual feedback

### Warning Message
```jsx
{!termsScrolled && (
  <p className="text-xs text-amber-700 mt-2 italic">
    Please scroll through the entire Terms and Conditions to enable the checkbox.
  </p>
)}
```
- **Visibility**: Shown only when user hasn't scrolled to bottom
- **Purpose**: Clear instruction on what user needs to do
- **Styling**: Small italic text in amber color

---

## User Flow

### Step-by-Step Process

1. **User Fills Form**
   - User enters all required reservation details
   - User reaches Terms and Conditions section at bottom of form

2. **Initial State**
   - Terms and Conditions section is visible
   - Scrollable div shows first few paragraphs
   - Checkbox is **DISABLED** (grayed out)
   - Warning message displayed: "Please scroll through the entire Terms and Conditions..."

3. **User Scrolls**
   - User begins scrolling through the Terms and Conditions
   - Scroll handler continuously checks scroll position
   - When user scrolls within 5px of bottom: `termsScrolled` → `true`

4. **Checkbox Enabled**
   - Checkbox becomes **ENABLED** (clickable)
   - Warning message disappears
   - User can now check the box

5. **User Accepts Terms**
   - User checks the checkbox
   - `termsAccepted` → `true`

6. **Form Submission**
   - User clicks "Submit Reservation" button
   - Validation checks if `termsAccepted === true`
   - **If unchecked**: Warning modal appears, submission blocked
   - **If checked**: Form submits successfully

7. **Post-Submission Reset**
   - Both `termsAccepted` and `termsScrolled` reset to `false`
   - User would need to scroll and accept again for next reservation

---

## Technical Implementation Details

### Code Location: Room Reservation Form
**File**: `app/reservations/room/page.js`

- **Lines 20-24**: State variable declarations
- **Lines 123-130**: `handleTermsScroll` function
- **Lines 143-152**: Terms validation in `handleSubmit`
- **Lines 210-211**: Terms state reset on successful submission
- **Lines 495-558**: Complete Terms and Conditions UI section (64 lines)

### Code Location: Event Reservation Form
**File**: `app/reservations/event/page.js`

- **Lines 31-35**: State variable declarations
- **Lines 140-147**: `handleTermsScroll` function
- **Lines 153-162**: Terms validation in `handleSubmit`
- **Lines 247-248**: Terms state reset on successful submission
- **Lines 488-489**: Terms state reset in Reset button
- **Lines 463-545**: Complete Terms and Conditions UI section (83 lines)

---

## Styling and Design

### Color Scheme
- **Primary**: Amber/Orange tones (`amber-500`, `amber-700`, `amber-800`, `amber-900`)
- **Background**: Light amber (`bg-amber-50`) for container, white for content
- **Text**: Dark gray (`text-gray-700`) for body text, amber tones for headings
- **Warning**: Amber for warning message and SweetAlert2 confirm button

### Responsive Design
- **Container**: Full width with padding
- **Scrollable Area**: Fixed height (256px) ensures visibility on all screen sizes
- **Text**: Responsive font sizes with adequate line spacing
- **Checkbox**: Standard size (4x4) with proper spacing from label

### Accessibility
- **Labels**: Properly associated with checkbox using `htmlFor` attribute
- **Disabled State**: Visual indication (cursor changes, opacity)
- **Instructions**: Clear guidance text when checkbox is disabled
- **Keyboard Navigation**: Checkbox is keyboard accessible when enabled

---

## Testing Checklist

### Functional Testing
- [ ] Checkbox is disabled when Terms section first appears
- [ ] Checkbox remains disabled while scrolling through first part of terms
- [ ] Checkbox enables when user scrolls to bottom of terms
- [ ] Warning message disappears after scrolling to bottom
- [ ] Checking the checkbox updates state correctly
- [ ] Unchecking the checkbox works properly
- [ ] Form submission is blocked when terms not accepted (shows warning)
- [ ] Form submission succeeds when terms are accepted
- [ ] Terms state resets after successful submission
- [ ] Terms state resets when Reset button is clicked

### Edge Cases
- [ ] Fast scrolling to bottom still triggers checkbox enable
- [ ] Refreshing page resets terms state correctly
- [ ] Navigating away and back resets state
- [ ] Multiple submissions require re-accepting terms each time
- [ ] Browser back button doesn't bypass terms requirement

### Browser Compatibility
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari
- [ ] Mobile browsers (iOS Safari, Chrome Mobile)

### Visual Testing
- [ ] Scrollbar is visible and functional
- [ ] Text is readable with proper contrast
- [ ] Amber color scheme is consistent
- [ ] Checkbox aligns properly with label
- [ ] Warning message displays correctly
- [ ] SweetAlert2 modal appears correctly

---

## Benefits

### Legal Compliance
- **Proof of Acceptance**: System ensures users actually read terms before accepting
- **Audit Trail**: Combined with form submission logs, provides evidence of user agreement
- **Fraud Prevention**: Terms explicitly state consequences of fake IDs

### User Experience
- **Clear Requirements**: Users know exactly what they're agreeing to
- **No Blind Acceptance**: Prevents users from clicking "I agree" without reading
- **Progressive Disclosure**: Content revealed as user scrolls, not overwhelming
- **Visual Feedback**: Disabled state clearly indicates action required

### Security
- **Identity Verification**: Terms establish ID requirements upfront
- **Data Protection**: Privacy policy clearly stated
- **Liability Protection**: Clear terms regarding fake IDs and cancellation policy

### Business Value
- **Reduced No-Shows**: Users aware of ID requirements before arrival
- **Better Compliance**: Users informed about data usage
- **Dispute Resolution**: Clear terms provide reference for conflicts

---

## Future Enhancements

### Potential Improvements
1. **Version Tracking**: Store terms version number with each submission
2. **Timestamp**: Record when user accepted terms
3. **PDF Export**: Allow users to download terms as PDF
4. **Multi-Language**: Provide terms in multiple languages
5. **Analytics**: Track how many users read terms vs just scroll quickly
6. **Expand to Dashboard**: Consider adding to dashboard reservation forms

### Accessibility Enhancements
1. **Screen Reader**: Add ARIA labels for better screen reader support
2. **Keyboard Shortcuts**: Allow keyboard-only navigation through terms
3. **High Contrast Mode**: Ensure visibility in high contrast mode
4. **Font Size**: Allow users to adjust text size

---

## Maintenance Notes

### When to Update Terms Content
- Changes to ID requirements
- Updates to privacy policy
- New legal requirements
- Changes to cancellation policy
- Updates to fraud prevention measures

### Update Procedure
1. Edit terms content in both form files
2. Update version date in Terms section
3. Test scroll functionality still works
4. Notify legal team of changes
5. Consider email notification to users with pending reservations

### Code Maintenance
- **State Management**: If migrating to Redux/Context, update state handling
- **Styling**: If changing design system, update Tailwind classes
- **Validation**: Keep validation logic consistent across all forms
- **Dependencies**: Monitor SweetAlert2 for updates

---

## Related Documentation
- `docs/ADDRESS_FIELD_REQUIRED_UPDATE.md` - Address field validation
- `docs/POS_RECEIPT_PRINTING_FIX.md` - Receipt printing fix
- `docs/RESERVATION_SYSTEM_VISUAL_GUIDE.md` - Overall reservation system guide
- `docs/ROOM_RESERVATION_QUICK_GUIDE.md` - Room reservation guide

---

## Support and Contact
For questions or issues regarding the Terms and Conditions implementation:
- Review this documentation
- Check form validation logic in source files
- Test in browser developer console
- Verify state management with React DevTools

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Status**: Implementation Complete ✅
