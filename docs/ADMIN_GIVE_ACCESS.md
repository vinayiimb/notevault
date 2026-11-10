# Giving a paid student access (admin)

A student reads paid notes only when their **Gmail** has an approved purchase for that subject and they are logged in.
Pick the row that matches how they paid.

| How they paid | Where | What to do |
|---|---|---|
| **UPI on the site** (they typed a UTR) | Admin > Payments, "Pending" | Check the UTR in your bank app, then **Approve & create login**. Send the login with the WhatsApp button. Reject if the UTR is wrong. |
| **Razorpay on the checkout page** | nothing to do | Approved and the login is created automatically. |
| **Razorpay in the "Need notes?" pop-up** (only a phone number) | Admin > Leads, "Paid orders" | Ask for their Gmail on WhatsApp, type it under **Give site access**, press the button, then **Send login on WhatsApp**. The order is marked delivered. |
| **Paid you directly, or a free grant** | Admin > Payments > Students | Type the Gmail under "Give access to a new Gmail", tick the subjects, save. This is a free grant with no 6-month expiry. |

Good to know:
- The student signs in at `/login` with "Continue with Google" (same Gmail) or the password you send. They can use 2 devices.
- Paid access ends 6 months after approval. Free grants and admin grants never expire.
- Lost phone or stuck on the 2-device limit: Admin > Payments > Students > forget devices.
- Forgot password: Admin > Payments, "Reset password and resend login".
- A subject must have published notes (with its semester set) before access can be given.
