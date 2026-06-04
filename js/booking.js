 // ── Booking Form ──
const bookingBtn = document.querySelector('button.btn')

if (bookingBtn) {
    bookingBtn.addEventListener('click', async () => {
        const fullName = document.getElementById('full-name').value
        const email = document.getElementById('email').value
        const phone = document.getElementById('phone').value
        const serviceType = document.getElementById('service').value
        const preferredDate = document.getElementById('date').value
        const preferredTime = document.getElementById('time').value
        const address = document.getElementById('address').value
        const notes = document.getElementById('notes').value

        if (!fullName || !email || !serviceType || !preferredDate) {
            alert('Please fill in all required fields')
            return
        }

        const { data: { session } } = await supabaseClient.auth.getSession()
        const userId = session ? session.user.id : null

        const { error } = await supabaseClient
            .from('bookings')
            .insert([{
                user_id: userId,
                full_name: fullName,
                email: email,
                phone: phone,
                service_type: serviceType,
                preferred_date: preferredDate,
                preferred_time: preferredTime,
                address: address,
                notes: notes,
                status: 'pending'
            }])

        if (error) {
            alert('Something went wrong: ' + error.message)
        } else {
            alert('Booking request received! We will be in touch to confirm.')
            window.location.href = 'index.html'
        }
    })
}