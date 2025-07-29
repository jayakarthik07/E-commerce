let user = null;
let cart = JSON.parse(localStorage.getItem("cart")) || [];
let orderStatus = null;
let products = [];

const membershipTiers = {
  Basic: { discount: 0, referralBonus: 5 },
  Premium: { discount: 15, referralBonus: 10 },
  VIP: { discount: 25, referralBonus: 20 },
};

function updateCartCount() {
  const cartCount = document.getElementById("cart-count");
  if (cartCount) cartCount.textContent = cart.length;
  localStorage.setItem("cart", JSON.stringify(cart));
}

async function checkAuthStatus() {
  const token = localStorage.getItem("jwt_token");
  if (token) {
    try {
      const response = await fetch("/api/user", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        user = await response.json();
        document.getElementById("user-info")?.textContent = `Welcome, ${user.name}`;
        document.getElementById("signin-btn")?.classList.add("d-none");
        document.getElementById("profile-btn")?.classList.remove("d-none");
        if (user.is_admin) document.getElementById("admin-btn")?.classList.remove("d-none");
      } else {
        localStorage.removeItem("jwt_token");
        user = null;
      }
    } catch {
      localStorage.removeItem("jwt_token");
      user = null;
    }
  }
}

async function signIn(event) {
  event.preventDefault();
  const email = document.getElementById("signin-email").value;
  const password = document.getElementById("signin-password").value;
  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (response.ok) {
      localStorage.setItem("jwt_token", data.token);
      window.location.href = "/";
    } else {
      alert(data.message || "Sign-in failed");
    }
  } catch {
    alert("Error during sign-in");
  }
}

async function signUp(event) {
  event.preventDefault();
  const name = document.getElementById("signup-name").value;
  const phone = document.getElementById("signup-phone").value;
  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;
  try {
    const response = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, email, password })
    });
    const data = await response.json();
    if (response.ok) {
      localStorage.setItem("jwt_token", data.token);
      window.location.href = "/";
    } else {
      alert(data.message || "Sign-up failed");
    }
  } catch {
    alert("Error during sign-up");
  }
}

function handleGoogleSignIn(credentialResponse) {
  const idToken = credentialResponse.credential;
  fetch("/api/google-signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken })
  }).then(res => res.json()).then(data => {
    if (data.token) {
      localStorage.setItem("jwt_token", data.token);
      window.location.href = "/";
    } else {
      alert(data.message || "Google Sign-In failed");
    }
  }).catch(() => alert("Error during Google Sign-In"));
}

function signOut() {
  localStorage.removeItem("jwt_token");
  user = null;
  cart = [];
  localStorage.setItem("cart", JSON.stringify(cart));
  window.location.href = "/signin";
}

async function fetchProducts() {
  try {
    const response = await fetch("/api/products");
    products = await response.json();
    renderProducts(products);
  } catch {
    alert("Error fetching products");
  }
}

function renderProducts(products) {
  const productGrid = document.getElementById("product-grid");
  if (productGrid) {
    productGrid.innerHTML = "";
    products.forEach(product => {
      const discountedPrice = (product.price * (1 - (user ? membershipTiers[user.membership].discount : 0) / 100) * (1 - (product.offer || 0) / 100)).toFixed(2);
      productGrid.innerHTML += `
        <div class="col-md-3 mb-4">
          <div class="card p-3">
            <img src="${product.image}" alt="${product.name}" class="img-fluid">
            <h3>${product.name}</h3>
            <p class="text-danger">$${discountedPrice} ${product.offer ? `(${product.offer}% off)` : ""}</p>
            <p>${product.category}</p>
            <button class="btn btn-warning" onclick="addToCart(${product.id})">Add to Cart</button>
            <button class="btn btn-warning" onclick="payWithStripe(${product.id})">Buy Now</button>
          </div>
        </div>
      `;
    });
  }
}

function searchProducts() {
  const searchTerm = document.getElementById("search-input")?.value || "";
  const category = document.getElementById("category-filter")?.value || "";
  const minPrice = parseFloat(document.getElementById("min-price")?.value) || 0;
  const maxPrice = parseFloat(document.getElementById("max-price")?.value) || Infinity;
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (!category || p.category === category) &&
    p.price >= minPrice && p.price <= maxPrice
  );
  renderProducts(filteredProducts);
}

function addToCart(productId) {
  if (!user) {
    alert("Please sign in to add items to cart");
    window.location.href = "/signin";
    return;
  }
  const product = products.find(p => p.id === productId);
  if (product) {
    cart.push(product);
    updateCartCount();
    if (window.location.pathname.includes("cart")) renderCart();
  }
}

function renderCart() {
  const cartItems = document.getElementById("cart-items");
  if (cartItems) {
    cartItems.innerHTML = cart.length === 0 ? "<p class='text-muted'>Cart is empty</p>" : "";
    cart.forEach(item => {
      const discountedPrice = (item.price * (1 - membershipTiers[user.membership].discount / 100) * (1 - (item.offer || 0) / 100)).toFixed(2);
      cartItems.innerHTML += `
        <li class="list-group-item">${item.name} - $${discountedPrice}</li>
      `;
    });
  }
}

function proceedToCheckout() {
  if (!user) {
    alert("Please sign in to proceed to checkout");
    window.location.href = "/signin";
    return;
  }
  if (cart.length === 0) {
    alert("Your cart is empty");
    return;
  }
  window.location.href = "/checkout";
}

function initGoogleMaps() {
  const input = document.getElementById("address-input");
  if (input) {
    const autocomplete = new google.maps.places.Autocomplete(input, { types: ["address"] });
    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      input.value = place.formatted_address;
    });
  }
}

function saveAddressAndProceed() {
  const address = document.getElementById("address-input")?.value;
  if (!address) {
    alert("Please enter a valid address");
    return;
  }
  fetch("/api/user", {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("jwt_token")}` },
    body: JSON.stringify({ address })
  }).then(() => {
    window.location.href = "/payment";
  }).catch(() => alert("Error saving address"));
}

function initGooglePay() {
  const paymentsClient = new google.payments.api.PaymentsClient({ environment: "TEST" });
  paymentsClient.isReadyToPay({
    apiVersion: 2,
    apiVersionMinor: 0,
    allowedPaymentMethods: ["CARD", "TOKENIZED_CARD"],
  }).then(() => {
    const button = paymentsClient.createButton({ onClick: handleGooglePay });
    const container = document.getElementById("google-pay-container");
    if (container) container.appendChild(button);
  }).catch(() => console.error("Google Pay initialization failed"));
}

function handleGooglePay() {
  const amount = cart.reduce((sum, item) => sum + item.price * (1 - membershipTiers[user.membership].discount / 100) * (1 - (item.offer || 0) / 100), 0);
  fetch("/api/create-payment-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("jwt_token")}` },
    body: JSON.stringify({ amount: amount * 100 })
  }).then(res => res.json()).then(data => {
    orderStatus = { status: "success", message: "Payment processed via Google Pay" };
    window.location.href = "/order_confirmation";
  }).catch(() => {
    orderStatus = { status: "error", message: "Google Pay payment failed" };
    window.location.href = "/order_confirmation";
  });
}

function payWithPhonePe() {
  const amount = cart.reduce((sum, item) => sum + item.price * (1 - membershipTiers[user.membership].discount / 100) * (1 - (item.offer || 0) / 100), 0);
  fetch("/api/phonepe-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("jwt_token")}` },
    body: JSON.stringify({ amount: amount * 100 })
  }).then(res => res.json()).then(data => {
    orderStatus = { status: "success", message: "Payment processed via PhonePe" };
    window.location.href = "/order_confirmation";
  }).catch(() => {
    orderStatus = { status: "error", message: "PhonePe payment failed" };
    window.location.href = "/order_confirmation";
  });
}

async function payWithStripe(productId = null) {
  const amount = productId 
    ? products.find(p => p.id === productId).price * (1 - membershipTiers[user.membership].discount / 100) * (1 - (products.find(p => p.id === productId).offer || 0) / 100)
    : cart.reduce((sum, item) => sum + item.price * (1 - membershipTiers[user.membership].discount / 100) * (1 - (item.offer || 0) / 100), 0);
  try {
    const response = await fetch("/api/create-payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("jwt_token")}` },
      body: JSON.stringify({ amount: amount * 100 }),
    });
    const { clientSecret } = await response.json();
    const { error } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card: { token: "tok_visa" } },
    });
    if (error) {
      orderStatus = { status: "error", message: `Payment failed: ${error.message}` };
    } else {
      orderStatus = { status: "success", message: "Payment successful via Stripe" };
      user.wallet_balance -= amount;
      fetch("/api/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("jwt_token")}` },
        body: JSON.stringify({ wallet_balance: user.wallet_balance })
      });
      const orderItems = cart;
      cart = [];
      updateCartCount();
      await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("jwt_token")}` },
        body: JSON.stringify({ amount, items: orderItems })
      });
    }
    window.location.href = "/order_confirmation";
  } catch {
    orderStatus = { status: "error", message: "Error processing payment" };
    window.location.href = "/order_confirmation";
  }
}

async function fetchUserProfile() {
  try {
    const response = await fetch("/api/user", {
      headers: { "Authorization": `Bearer ${localStorage.getItem("jwt_token")}` }
    });
    if (response.ok) {
      user = await response.json();
      document.getElementById("user-name")?.textContent = user.name;
      document.getElementById("user-email")?.textContent = user.email;
      document.getElementById("user-phone")?.textContent = user.phone;
      document.getElementById("user-address")?.textContent = user.address || "None";
      document.getElementById("user-membership")?.textContent = user.membership;
      document.getElementById("user-wallet")?.textContent = user.wallet_balance.toFixed(2);
      document.getElementById("referral-count")?.textContent = user.referrals.length;
      updateMembershipButtons();
    }
  } catch {
    alert("Error fetching profile");
  }
}

function updateMembershipButtons() {
  document.getElementById("basic-btn")?.setAttribute("disabled", user.membership === "Basic");
  document.getElementById("premium-btn")?.setAttribute("disabled", user.membership === "Premium");
  document.getElementById("vip-btn")?.setAttribute("disabled", user.membership === "VIP");
}

function upgradeMembership(tier) {
  fetch("/api/membership", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("jwt_token")}` },
    body: JSON.stringify({ membership: tier }),
  }).then(() => {
    user.membership = tier;
    fetchUserProfile();
    if (window.location.pathname.includes("index")) fetchProducts();
  }).catch(() => alert("Error upgrading membership"));
}

function addReferral() {
  if (user.referrals.length >= 2) {
    alert("Maximum 2 referrals allowed (Unilevel MLM).");
    return;
  }
  const newReferralId = Math.random().toString(36).substring(2, 8);
  fetch("/api/referrals", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("jwt_token")}` },
    body: JSON.stringify({ referralId: newReferralId }),
  }).then(() => {
    user.referrals.push(newReferralId);
    fetchUserProfile();
  }).catch(() => alert("Error adding referral"));
}

async function fetchAdminData() {
  try {
    const userResponse = await fetch("/api/users", {
      headers: { "Authorization": `Bearer ${localStorage.getItem("jwt_token")}` }
    });
    if (userResponse.ok) {
      const users = await userResponse.json();
      const adminUsers = document.getElementById("admin-users");
      if (adminUsers) {
        adminUsers.innerHTML = "";
        users.forEach(u => {
          adminUsers.innerHTML += `
            <tr>
              <td>${u.id}</td>
              <td>${u.name}</td>
              <td>${u.membership}</td>
              <td>${u.referrals.join(", ")}</td>
              <td>${u.is_admin ? "Yes" : "No"}</td>
              <td><button class="btn btn-warning" onclick="deleteUser(${u.id})">Delete</button></td>
            </tr>
          `;
        });
      }
    }

    const productResponse = await fetch("/api/products", {
      headers: { "Authorization": `Bearer ${localStorage.getItem("jwt_token")}` }
    });
    if (productResponse.ok) {
      products = await productResponse.json();
      const adminProducts = document.getElementById("admin-products");
      if (adminProducts) {
        adminProducts.innerHTML = "";
        products.forEach(p => {
          adminProducts.innerHTML += `
            <tr>
              <td>${p.id}</td>
              <td>${p.name}</td>
              <td>$${p.price.toFixed(2)}</td>
              <td>${p.category}</td>
              <td>${p.offer || 0}%</td>
              <td><button class="btn btn-warning" onclick="deleteProduct(${p.id})">Delete</button></td>
            </tr>
          `;
        });
      }
    }
  } catch {
    alert("Error fetching admin data");
  }
}

function addProduct(event) {
  event.preventDefault();
  const name = document.getElementById("product-name").value;
  const price = parseFloat(document.getElementById("product-price").value);
  const image = document.getElementById("product-image").value;
  const category = document.getElementById("product-category").value;
  const offer = parseFloat(document.getElementById("product-offer").value) || 0;
  fetch("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("jwt_token")}` },
    body: JSON.stringify({ name, price, image, category, offer }),
  }).then(() => {
    fetchAdminData();
    document.getElementById("add-product-form").reset();
  }).catch(() => alert("Error adding product"));
}

function saveAdminDetails(event) {
  event.preventDefault();
  const phone = document.getElementById("admin-phone").value;
  const shipping = document.getElementById("admin-shipping").value;
  const payment = document.getElementById("admin-payment").value;
  fetch("/api/admin-details", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("jwt_token")}` },
    body: JSON.stringify({ phone, shipping_address: shipping, payment_method: payment }),
  }).then(() => {
    alert("Admin details saved");
  }).catch(() => alert("Error saving admin details"));
}

function addAdmin(event) {
  event.preventDefault();
  const email = document.getElementById("admin-email").value;
  fetch("/api/add-admin", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("jwt_token")}` },
    body: JSON.stringify({ email }),
  }).then(() => {
    fetchAdminData();
    document.getElementById("add-admin-form").reset();
  }).catch(() => alert("Error adding admin"));
}

function deleteUser(userId) {
  fetch(`/api/users/${userId}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${localStorage.getItem("jwt_token")}` }
  }).then(() => fetchAdminData()).catch(() => alert("Error deleting user"));
}

function deleteProduct(productId) {
  fetch(`/api/products/${productId}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${localStorage.getItem("jwt_token")}` }
  }).then(() => fetchAdminData()).catch(() => alert("Error deleting product"));
}

function displayOrderStatus() {
  const statusElement = document.getElementById("order-status");
  const messageElement = document.getElementById("order-message");
  if (orderStatus) {
    statusElement.textContent = orderStatus.status === "success" ? "Order Confirmed!" : "Payment Failed";
    messageElement.textContent = orderStatus.message;
  }
}