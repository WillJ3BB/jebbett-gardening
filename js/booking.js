// Pre-fill service from URL query params (e.g. booking.html?service=lawn-cuts)
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const serviceParam = urlParams.get('service');
    if (serviceParam) {
        const select = document.getElementById('service_type');
        if (select) select.value = serviceParam;
    }

    // Lock date input to minimum tomorrow (no past dates or same-day)
    const dateInput = document.getElementById('preferred_date');
    if (dateInput) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const yyyy = tomorrow.getFullYear();
        const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
        const dd = String(tomorrow.getDate()).padStart(2, '0');
        dateInput.min = `${yyyy}-${mm}-${dd}`;
    }
});

// ── Validation Helpers ──
function isValidFullName(name) {
    // Requires at least first name and last name (2 words, min 2 letters each)
    const trimmed = name.trim();
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) return false;
    return parts.every(part => part.length >= 2 && /^[a-zA-Z'-\.]+$/.test(part));
}

function isValidUKPhone(phone) {
    // Cleans spaces/hyphens: matches UK mobile (07xxx) or landline (01xxx, 02xxx) or +44
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    const ukPhoneRegex = /^(?:(?:\+44\s?|0)(?:7\d{3}|1\d{3}|2\d{3}|3\d{3}|8\d{3})\s?\d{6}|(?:\+44\s?|0)\d{10,11})$/;
    return ukPhoneRegex.test(cleaned) && cleaned.length >= 10 && cleaned.length <= 13;
}

function isValidEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email.trim());
}

function isValidUKAddress(address) {
    const trimmed = address.trim();
    // Must be at least 8 characters and contain street + UK Postcode pattern
    if (trimmed.length < 8) return false;
    const ukPostcodeRegex = /([Gg][Ii][Rr] 0[Aa]{2})|((([A-Za-z][0-9]{1,2})|(([A-Za-z][A-Ha-hJ-Yj-y][0-9]{1,2})|(([A-Za-z][0-9][A-Za-z])|([A-Za-z][A-Ha-hJ-Yj-y][0-9][A-Za-z]?))))\s?[0-9][A-Za-z]{2})/;
    return ukPostcodeRegex.test(trimmed);
}

function clearErrors() {
    document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
    document.querySelectorAll('.form-group input, .form-group select').forEach(el => el.classList.remove('input-invalid'));
    const banner = document.getElementById('form-general-error');
    if (banner) {
        banner.style.display = 'none';
        banner.textContent = '';
    }
}

function setError(fieldId, message) {
    const errSpan = document.getElementById(`err-${fieldId}`);
    const input = document.getElementById(fieldId);
    if (errSpan) errSpan.textContent = message;
    if (input) input.classList.add('input-invalid');
}

// ── Form Submission Handler ──
const bookingForm = document.getElementById('booking-form');

if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors();

        // 1. Invisible Honeypot Check (Blocks Automated Bots Silently)
        const honeypot = document.getElementById('company_website')?.value;
        if (honeypot && honeypot.trim() !== '') {
            console.warn('Spam bot submission blocked.');
            // Fake success response to confuse the bot script without doing anything
            alert('Booking received!');
            bookingForm.reset();
            return;
        }

        // 2. Extract values
        const fullName = document.getElementById('full_name').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const email = document.getElementById('email').value.trim();
        const address = document.getElementById('address').value.trim();
        const serviceType = document.getElementById('service_type').value;
        const preferredTime = document.getElementById('preferred_time').value;
        const preferredDate = document.getElementById('preferred_date').value;
        const notes = document.getElementById('notes').value.trim();

        let hasError = false;

        // 3. Strict Validation Checks
        if (!fullName) {
            setError('full_name', 'Full name is required.');
            hasError = true;
        } else if (!isValidFullName(fullName)) {
            setError('full_name', 'Please provide both your first and last name.');
            hasError = true;
        }

        if (!phone) {
            setError('phone', 'Phone number is required.');
            hasError = true;
        } else if (!isValidUKPhone(phone)) {
            setError('phone', 'Please enter a valid UK phone number (e.g. 07123 456789).');
            hasError = true;
        }

        if (!email) {
            setError('email', 'Email address is required.');
            hasError = true;
        } else if (!isValidEmail(email)) {
            setError('email', 'Please enter a valid email address.');
            hasError = true;
        }

        if (!address) {
            setError('address', 'Property address and postcode are required.');
            hasError = true;
        } else if (!isValidUKAddress(address)) {
            setError('address', 'Please include your street address and a valid UK postcode (e.g. BN21 4TL).');
            hasError = true;
        }

        if (!serviceType) {
            setError('service_type', 'Please select a service.');
            hasError = true;
        }

        if (!preferredTime) {
            setError('preferred_time', 'Please select a preferred time slot.');
            hasError = true;
        }

        if (!preferredDate) {
            setError('preferred_date', 'Please choose an appointment date.');
            hasError = true;
        } else {
            const selected = new Date(preferredDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (selected <= today) {
                setError('preferred_date', 'Please select a date from tomorrow onwards.');
                hasError = true;
            }
        }

        if (hasError) {
            const banner = document.getElementById('form-general-error');
            if (banner) {
                banner.textContent = 'Please correct the highlighted fields above before submitting.';
                banner.style.display = 'block';
            }
            return;
        }

        // 4. Submission to Supabase
        const submitBtn = document.getElementById('submit-booking-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting Booking...';

        try {
            // Count existing bookings to display sequential reference code
            const { count } = await supabaseClient
                .from('bookings')
                .select('*', { count: 'exact', head: true });

            const nextSeq = (count || 0) + 1;
            const refCode = `#JEB-${String(nextSeq).padStart(3, '0')}`;

            const { data, error } = await supabaseClient
                .from('bookings')
                .insert([{
                    full_name: fullName,
                    phone: phone,
                    email: email,
                    address: address,
                    service_type: serviceType,
                    preferred_time: preferredTime,
                    preferred_date: preferredDate,
                    notes: notes || null,
                    status: 'pending',
                    created_at: new Date().toISOString()
                }])
                .select();

            if (error) throw error;

            // Show Confirmation Modal
            showSuccessModal(refCode, serviceType, preferredDate, preferredTime, address);
            bookingForm.reset();

        } catch (err) {
            console.error('Booking submission error:', err);
            const banner = document.getElementById('form-general-error');
            if (banner) {
                banner.textContent = 'Could not submit your booking: ' + (err.message || 'Please check your connection and try again.');
                banner.style.display = 'block';
            }
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Booking Request →';
        }
    });
}

function showSuccessModal(ref, service, date, time, address) {
    document.getElementById('modal-ref-code').textContent = ref;
    document.getElementById('modal-summary-service').textContent = service.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    document.getElementById('modal-summary-date').textContent = new Date(date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('modal-summary-time').textContent = time;
    document.getElementById('modal-summary-address').textContent = address;

    const modal = document.getElementById('booking-success-modal');
    if (modal) modal.style.display = 'flex';
}

function closeSuccessModal() {
    const modal = document.getElementById('booking-success-modal');
    if (modal) modal.style.display = 'none';
    window.location.href = 'index.html';
}
window.closeSuccessModal = closeSuccessModal;