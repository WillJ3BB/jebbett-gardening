
'use strict';

// =====================================================
// Jebbett Gardening Solutions - Booking Requests
// =====================================================

// Calculate tomorrow's date in local time.
function tomorrowISO() {
    const date = new Date();

    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + 1);

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Prevent requests for today or earlier.
function updateMinimumBookingDate() {
    const input = document.getElementById('preferred_date');

    if (input) {
        input.min = tomorrowISO();
    }
}

// Preselect a service when arriving from the Services page.
document.addEventListener('DOMContentLoaded', () => {
    const service = new URLSearchParams(window.location.search).get('service');
    const select = document.getElementById('service_type');

    if (
        service &&
        select &&
        Array.from(select.options).some(option => option.value === service)
    ) {
        select.value = service;
    }

    updateMinimumBookingDate();
});

// =====================================================
// Field validation
// =====================================================

function isValidFullName(name) {
    const parts = name.trim().split(/\s+/);

    return parts.length >= 2 &&
        parts.every(part =>
            part.length >= 2 &&
            /^[a-zA-Z'\-.]+$/.test(part)
        );
}

function isValidUKPhone(phone) {
    const cleaned = phone.replace(/[\s\-()]/g, '');

    return /^(?:\+44\d{10}|0\d{10})$/.test(cleaned);
}

function isValidEmail(email) {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(
        email.trim()
    );
}

function isValidUKAddress(address) {
    return address.trim().length >= 5 &&
        /[a-zA-Z]/.test(address);
}

// Standardise UK postcode formatting.
function formatUKPostcode(value) {
    const compact = value
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '');

    return compact.length >= 5
        ? `${compact.slice(0, -3)} ${compact.slice(-3)}`
        : compact;
}

function isValidUKPostcode(value) {
    return /^(?:GIR 0AA|(?:[A-Z]{1,2}\d[A-Z\d]?) \d[A-Z]{2})$/.test(
        formatUKPostcode(value)
    );
}

// =====================================================
// Validation error messages
// =====================================================

function clearErrors() {
    document.querySelectorAll('.field-error').forEach(el => {
        el.textContent = '';
    });

    document.querySelectorAll(
        '.form-group input, .form-group select'
    ).forEach(el => {
        el.classList.remove('input-invalid');
    });

    const banner = document.getElementById('form-general-error');

    if (banner) {
        banner.style.display = 'none';
        banner.textContent = '';
    }
}

function setError(id, message) {
    const span = document.getElementById(`err-${id}`);
    const field = document.getElementById(id);

    if (span) {
        span.textContent = message;
    }

    if (field) {
        field.classList.add('input-invalid');
    }
}

function showGeneralError(message) {
    const banner = document.getElementById('form-general-error');

    if (banner) {
        banner.textContent = message;
        banner.style.display = 'block';
    }
}

// =====================================================
// Booking form submission
// =====================================================

const bookingForm = document.getElementById('booking-form');

if (bookingForm) {
    bookingForm.addEventListener('submit', async event => {
        event.preventDefault();

        clearErrors();

        // Honeypot protection.
        if (document.getElementById('company_website')?.value.trim()) {
            bookingForm.reset();
            return;
        }

        // Collect form values.
        const value = id => document.getElementById(id).value.trim();

        const fullName = value('full_name');
        const phone = value('phone');
        const email = value('email');
        const streetAddress = value('address');
        const postcodeInput = value('postcode');
        const postcode = formatUKPostcode(postcodeInput);

        const serviceType = value('service_type');
        const preferredTime = value('preferred_time');
        const preferredDate = value('preferred_date');
        const notes = value('notes');

        let invalid = false;

        function check(id, condition, message) {
            if (!condition) {
                setError(id, message);
                invalid = true;
            }
        }

        // Validate customer information.
        check(
            'full_name',
            isValidFullName(fullName),
            'Please enter your first and last name.'
        );

        check(
            'phone',
            isValidUKPhone(phone),
            'Please enter a valid UK phone number.'
        );

        check(
            'email',
            isValidEmail(email),
            'Please enter a valid email address.'
        );

        check(
            'address',
            isValidUKAddress(streetAddress),
            'Please enter your property address.'
        );

        check(
            'postcode',
            isValidUKPostcode(postcodeInput),
            'Please enter a valid UK postcode (e.g. BN21 4TL).'
        );

        check(
            'service_type',
            Boolean(serviceType),
            'Please select a service.'
        );

        check(
            'preferred_time',
            Boolean(preferredTime),
            'Please select a preferred time slot.'
        );

        updateMinimumBookingDate();

        check(
            'preferred_date',
            Boolean(preferredDate) && preferredDate >= tomorrowISO(),
            'Please select a date from tomorrow onwards.'
        );

        if (invalid) {
            showGeneralError(
                'Please correct the highlighted fields above before submitting.'
            );
            return;
        }

        // Keep the existing Supabase address column.
        const fullAddress = `${streetAddress}, ${postcode}`;

        const button = document.getElementById('submit-booking-btn');

        button.disabled = true;
        button.textContent = 'Submitting Request...';

        try {
            if (typeof supabaseClient === 'undefined') {
                throw new Error('Booking service unavailable.');
            }

            // Submit booking request to Supabase.
            const { data, error } = await supabaseClient
                .from('bookings')
                .insert([{
                    full_name: fullName,
                    phone,
                    email,
                    address: fullAddress,
                    service_type: serviceType,
                    preferred_time: preferredTime,
                    preferred_date: preferredDate,
                    notes: notes || null,
                    status: 'pending',
                    created_at: new Date().toISOString()
                }])
                .select();

            if (error) {
                throw error;
            }

            const booking = data?.[0];

            if (!booking) {
                throw new Error(
                    'Booking response could not be verified.'
                );
            }

            // Customer-facing reference based on the booking UUID.
            // The complete UUID remains the authoritative database ID.
            const ref = booking.id
                ? `#JEB-${String(booking.id).replace(/-/g, '').slice(0, 8).toUpperCase()}`
                : 'Reference pending';

            showSuccessModal(
                ref,
                serviceType,
                preferredDate,
                preferredTime,
                fullAddress
            );

            bookingForm.reset();
            updateMinimumBookingDate();

        } catch (error) {
            console.error('Booking request error:', error);

            showGeneralError(
                'We could not verify your booking request. Please contact Jebbett Gardening before submitting again.'
            );

        } finally {
            button.disabled = false;
            button.textContent = 'Submit Booking Request →';
        }
    });
}

// =====================================================
// Booking request success modal
// =====================================================

function showSuccessModal(ref, service, date, time, address) {
    document.getElementById('modal-ref-code').textContent = ref;

    const select = document.getElementById('service_type');

    const option = Array.from(select?.options || [])
        .find(item => item.value === service);

    document.getElementById('modal-summary-service').textContent =
        option?.textContent.trim() || service.replace(/-/g, ' ');

    const [year, month, day] = date.split('-').map(Number);

    document.getElementById('modal-summary-date').textContent =
        new Date(year, month - 1, day).toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

    document.getElementById('modal-summary-time').textContent = time;

    document.getElementById('modal-summary-address').textContent = address;

    const modal = document.getElementById('booking-success-modal');

    if (modal) {
        modal.style.display = 'flex';
    }
}

// Close the modal and return to the homepage.
function closeSuccessModal() {
    const modal = document.getElementById('booking-success-modal');

    if (modal) {
        modal.style.display = 'none';
    }

    window.location.href = 'index.html';
}

window.closeSuccessModal = closeSuccessModal;
