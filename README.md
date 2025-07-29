LuxeMart E-commerce App
A premium e-commerce web app with user authentication, product management, payment integrations, and admin controls, built with Flask, PostgreSQL, and Bootstrap.
Features

Home: Browse products with a centered search bar, category filters, and dynamic price range filter (toggled via "Filter" button). Sign-in required for cart/checkout.
Sign-In/Sign-Up: Google Sign-In or email/password; collects name, phone number during sign-up.
Profile: View/update user details (name, email, phone, address), membership, and MLM referrals (max 2).
Cart/Checkout: Add items to cart (sign-in required), select/add address via Google Maps API.
Payment: Google Pay, PhonePe, Stripe (card/account) with success/error feedback.
Membership: Upgrade to Basic, Premium, or VIP tiers.
Admin: Manage users, add admins; separate product control page for adding/editing products.
Security: JWT authentication, HTTPS, input sanitization.

Setup

Clone the repository:git clone <repository-url>
cd ecommerce-app


Create a virtual environment and install dependencies:python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt


Set up PostgreSQL:
Install PostgreSQL and create a database named ecommerce.
Update app.py with your database URL (e.g., postgresql://user:password@localhost:5432/ecommerce).


Set environment variables:export FLASK_APP=app.py
export JWT_SECRET_KEY=your_jwt_secret_key
export STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
export GOOGLE_CLIENT_ID=your_google_client_id
export GOOGLE_MAPS_API_KEY=your_google_maps_api_key


Run the app:flask run



Deployment to Heroku

Install Heroku CLI and login:heroku login


Create a Heroku app:heroku create


Add PostgreSQL add-on:
