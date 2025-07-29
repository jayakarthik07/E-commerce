from flask import Flask, jsonify, request, render_template
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager, jwt_required, create_access_token, get_jwt_identity
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import stripe
import jwt
import os

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'postgresql://user:password@localhost:5432/ecommerce')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = 'your_jwt_secret_key'
stripe.api_key = 'sk_test_your_stripe_secret_key'

db = SQLAlchemy(app)
jwt = JWTManager(app)
CORS(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    phone = db.Column(db.String(20))
    password = db.Column(db.String(200))
    address = db.Column(db.String(200))
    membership = db.Column(db.String(20), default='Basic')
    wallet_balance = db.Column(db.Float, default=0.0)
    referrals = db.Column(db.ARRAY(db.String), default=[])
    is_admin = db.Column(db.Boolean, default=False)
    admin_phone = db.Column(db.String(20))
    admin_shipping_address = db.Column(db.String(200))
    admin_payment_method = db.Column(db.String(50))

class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    price = db.Column(db.Float, nullable=False)
    image = db.Column(db.String(200))
    category = db.Column(db.String(50), nullable=False)
    offer = db.Column(db.Float, default=0.0)

class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    items = db.Column(db.JSON, nullable=False)
    status = db.Column(db.String(20), default='Pending')

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(email=data['email']).first()
    if user and check_password_hash(user.password, data['password']):
        return jsonify({'token': create_access_token(identity=user.id)})
    return jsonify({'message': 'Invalid credentials'}), 401

@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json()
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'message': 'Email already exists'}), 400
    user = User(
        name=data['name'],
        email=data['email'],
        phone=data['phone'],
        password=generate_password_hash(data['password'])
    )
    db.session.add(user)
    db.session.commit()
    return jsonify({'token': create_access_token(identity=user.id)})

@app.route('/api/google-signin', methods=['POST'])
def google_signin():
    data = request.get_json()
    id_token = data['id_token']
    try:
        decoded = jwt.decode(id_token, options={"verify_signature": False})
        user = User.query.filter_by(email=decoded['email']).first()
        if not user:
            user = User(
                name=decoded['name'],
                email=decoded['email'],
                phone=decoded.get('phone', ''),
                password=generate_password_hash(decoded['sub'])
            )
            db.session.add(user)
            db.session.commit()
        return jsonify({'token': create_access_token(identity=user.id)})
    except:
        return jsonify({'message': 'Invalid Google token'}), 400

@app.route('/api/products', methods=['GET', 'POST'])
def handle_products():
    if request.method == 'GET':
        products = Product.query.all()
        return jsonify([{'id': p.id, 'name': p.name, 'price': p.price, 'image': p.image, 'category': p.category, 'offer': p.offer} for p in products])
    else:
        data = request.get_json()
        product = Product(
            name=data['name'],
            price=data['price'],
            image=data['image'],
            category=data['category'],
            offer=data.get('offer', 0)
        )
        db.session.add(product)
        db.session.commit()
        return jsonify({'message': 'Product added'})

@app.route('/api/products/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_product(id):
    product = Product.query.get(id)
    if product:
        db.session.delete(product)
        db.session.commit()
        return jsonify({'message': 'Product deleted'})
    return jsonify({'error': 'Product not found'}), 404

@app.route('/api/users', methods=['GET'])
@jwt_required()
def get_users():
    users = User.query.all()
    return jsonify([{'id': u.id, 'name': u.name, 'membership': u.membership, 'referrals': u.referrals, 'is_admin': u.is_admin} for u in users])

@app.route('/api/users/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_user(id):
    user = User.query.get(id)
    if user:
        db.session.delete(user)
        db.session.commit()
        return jsonify({'message': 'User deleted'})
    return jsonify({'error': 'User not found'}), 404

@app.route('/api/user', methods=['GET', 'PUT'])
@jwt_required()
def user_profile():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if request.method == 'GET':
        return jsonify({
            'name': user.name,
            'email': user.email,
            'phone': user.phone,
            'address': user.address,
            'membership': user.membership,
            'walletBalance': user.wallet_balance,
            'referrals': user.referrals,
            'is_admin': user.is_admin
        })
    else:
        data = request.get_json()
        user.address = data.get('address', user.address)
        db.session.commit()
        return jsonify({'message': 'Profile updated'})

@app.route('/api/membership', methods=['POST'])
@jwt_required()
def update_membership():
    data = request.get_json()
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    user.membership = data['membership']
    db.session.commit()
    return jsonify({'message': 'Membership updated'})

@app.route('/api/referrals', methods=['POST'])
@jwt_required()
def add_referral():
    data = request.get_json()
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if len(user.referrals) >= 2:
        return jsonify({'error': 'Maximum 2 referrals allowed'}), 400
    user.referrals.append(data['referralId'])
    db.session.commit()
    return jsonify({'message': 'Referral added'})

@app.route('/api/create-payment-intent', methods=['POST'])
@jwt_required()
def create_payment_intent():
    data = request.get_json()
    intent = stripe.PaymentIntent.create(
        amount=int(data['amount']),
        currency='usd',
        payment_method_types=['card']
    )
    return jsonify({'clientSecret': intent.client_secret})

@app.route('/api/phonepe-payment', methods=['POST'])
@jwt_required()
def phonepe_payment():
    data = request.get_json()
    # Placeholder for PhonePe API integration
    return jsonify({'message': 'PhonePe payment initiated'})

@app.route('/api/admin-details', methods=['POST'])
@jwt_required()
def save_admin_details():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    data = request.get_json()
    user.admin_phone = data['phone']
    user.admin_shipping_address = data['shipping_address']
    user.admin_payment_method = data['payment_method']
    db.session.commit()
    return jsonify({'message': 'Admin details saved'})

@app.route('/api/add-admin', methods=['POST'])
@jwt_required()
def add_admin():
    user_id = get_jwt_identity()
    admin = User.query.get(user_id)
    if not admin.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    data = request.get_json()
    user = User.query.filter_by(email=data['email']).first()
    if user:
        user.is_admin = True
        db.session.commit()
        return jsonify({'message': 'Admin added'})
    return jsonify({'error': 'User not found'}), 404

@app.route('/api/orders', methods=['POST'])
@jwt_required()
def create_order():
    user_id = get_jwt_identity()
    data = request.get_json()
    order = Order(
        user_id=user_id,
        amount=data['amount'],
        items=data['items'],
        status='Completed'
    )
    db.session.add(order)
    db.session.commit()
    return jsonify({'message': 'Order created'})

# Page serving routes - Use templates and render_template
@app.route('/')
@app.route('/signin')
@app.route('/signup')
@app.route('/profile')
@app.route('/cart')
@app.route('/checkout')
@app.route('/payment')
@app.route('/membership')
@app.route('/admin')
@app.route('/admin_products')
@app.route('/order_confirmation')
def serve_page():
    page_name = request.path[1:] or 'index'
    try:
        return render_template(f"{page_name}.html")
    except Exception:
        return "Page not found", 404

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        if not Product.query.first():
            db.session.add_all([
                Product(name="Luxury Watch", price=199.99, image="https://via.placeholder.com/300?text=Luxury+Watch", category="Fashion", offer=10),
                Product(name="Designer Bag", price=299.99, image="https://via.placeholder.com/300?text=Designer+Bag", category="Fashion", offer=15),
                Product(name="Smartphone", price=499.99, image="https://via.placeholder.com/300?text=Smartphone", category="Electronics")
            ])
        if not User.query.first():
            db.session.add(User(
                name="Admin",
                email="admin@example.com",
                password=generate_password_hash("admin123"),
                is_admin=True,
                membership="VIP",
                wallet_balance=1000
            ))
        db.session.commit()
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=True)
