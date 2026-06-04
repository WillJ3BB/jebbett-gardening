// ── Contact Form ──
const contactBtn = document.querySelector('.contact-form .btn')

if (contactBtn) {
    contactBtn.addEventListener('click', async () => {
        const name = document.getElementById('name').value
        const email = document.getElementById('email').value
        const message = document.getElementById('message').value

        if (!name || !email || !message) {
            alert('Please fill in all fields')
            return
        }

        contactBtn.textContent = 'Sending...'
        contactBtn.disabled = true

        emailjs.init('ohlaxkcgROilotg3E')

        emailjs.send('service_6gw0lzk', 'template_bpcanvo', {
            from_name: name,
            from_email: email,
            message: message
        })
        .then(() => {
            alert('Message sent! We will get back to you soon.')
            document.getElementById('name').value = ''
            document.getElementById('email').value = ''
            document.getElementById('message').value = ''
            contactBtn.textContent = 'Send Message'
            contactBtn.disabled = false
        })
        .catch((error) => {
            alert('Something went wrong. Please try again.')
            console.error('EmailJS error:', error)
            contactBtn.textContent = 'Send Message'
            contactBtn.disabled = false
        })
    })
}