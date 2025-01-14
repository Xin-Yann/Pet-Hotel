import { getFirestore, collection, getDocs, doc, getDoc, setDoc, query, where, updateDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

const db = getFirestore();
const auth = getAuth();

(function () {
    emailjs.init("w5NmY3KN7iiOu69jP");
})();

function getCurrentUserId() {
    const user = auth.currentUser;
    return user ? user.uid : null;
}

auth.onAuthStateChanged(async (user) => {
    try {
        if (user) {
            const userId = getCurrentUserId();
            if (!userId) {
                console.error("Invalid userId:", userId);
                return;
            }
            await displayCartItems();
            console.log("User authenticated. User ID:", userId);
        } else {
            console.log("No user is authenticated.");
        }
    } catch (error) {
        console.error("Error in authentication state change:", error);
    }
});

async function getCartData(user) {
    try {
        if (user) {
            const userId = getCurrentUserId();
            if (!userId) {
                console.error("Invalid userId:", userId);
                return [];
            }

            const cartRef = doc(collection(db, 'carts'), userId);
            const cartDoc = await getDoc(cartRef);
            if (cartDoc.exists()) {
                return cartDoc.data().cart || [];
            } else {
                console.log("Cart document does not exist for the current user.");

            } return [];
        }
    } catch (error) {
        console.error("Error fetching cart data from Firestore:", error);
        return [];
    }
}

const cartContainer = document.getElementById('cartItems');

async function displayCartItems() {
    const userId = getCurrentUserId();
    console.log("User ID:", userId);

    let cartItems = await getCartData(userId);
    console.log("Cart Items:", cartItems);

    if (!cartItems) {
        cartItems = [];
    }

    cartContainer.innerHTML = '';

    let subtotal = 0;

    for (let index = 0; index < cartItems.length; index++) {
        const item = cartItems[index];

        const cartItemDiv = document.createElement('div');
        cartItemDiv.classList.add('cart-item');

        cartItemDiv.innerHTML = `
            <div class="cart-item-info">
                <p>${index + 1}</p>
                <div class="cart-item-image">
                    <img src="${item.image}" alt="${item.name}">
                    <h5>${item.name}</h5>
                </div>
                <p>Barcode: ${item.barcode}</p>
                <p>Type: ${item.type}</p>
                <p>Price: RM ${item.price}</p>
                <p>Quantity: ${item.quantity}</p>
                <p class="total-price-cell"></p>
            </div>
        `;

        cartContainer.appendChild(cartItemDiv);

        const totalPriceCell = cartItemDiv.querySelector('.total-price-cell');
        calculateTotalPrice(item).then(itemTotalPrice => {
            totalPriceCell.textContent = `RM ${itemTotalPrice.toFixed(2)}`;

            subtotal += itemTotalPrice;

            const salestax = 0.10;

            updateTotals(subtotal, salestax);
        });
    }
}

async function calculateTotalPrice(item) {
    const price = parseFloat(item.price) || 0;
    const quantity = parseInt(item.quantity) || 0;
    return price * quantity;
}

let isStaff = false;
const discountRate = 0.10;

function applyDiscount() {
    isStaff = true;
    displayCartItems();

}

document.getElementById('apply-discount').addEventListener('click', applyDiscount);

async function updateTotals(subtotal, salestaxRate) {
    console.log('Update Totals Function Start');

    const pointDiscountElement = document.getElementById('pointDiscount');
    console.log('Points Discount Element:', pointDiscountElement);

    const pointsText = pointDiscountElement.textContent;
    console.log(`Points Text: ${pointsText}`);
    const pointsValue = parseFloat(pointsText.replace(/[^0-9.-]+/g, "")) || 0;
    console.log(`Points Value: ${pointsValue}`);

    const salesTax = subtotal * salestaxRate;
    console.log(`Calculated Sales Tax: ${salesTax}`);

    const discount = isStaff ? subtotal * discountRate : 0;

    console.log(`Calculated Discount: ${discount}`);

    const discountedStaff = subtotal - discount;
    console.log(`Discounted Subtotal: ${discountedStaff}`);

    const totalPrice = discountedStaff + salesTax + pointsValue;
    console.log(`Total Price Calculation: ${discountedStaff} + ${salesTax} + ${pointsValue} = ${totalPrice}`);

    document.getElementById('Subtotal').textContent = `RM ${subtotal.toFixed(2)}`;
    document.getElementById('salestax').textContent = `RM ${salesTax.toFixed(2)}`;
    document.getElementById('discount').textContent = `- RM ${discount.toFixed(2)}`;
    document.getElementById('totalprice').textContent = `RM ${totalPrice.toFixed(2)}`;
}

async function generateTransactionID() {
    const transactionCounterDocRef = doc(db, 'metadata', 'transactionCounter');
    try {
        const transactionCounterDoc = await getDoc(transactionCounterDocRef);
        let newTransactionID = 1;
        if (transactionCounterDoc.exists()) {
            newTransactionID = transactionCounterDoc.data().lastTransactionID + 1;
        }
        await setDoc(transactionCounterDocRef, { lastTransactionID: newTransactionID });
        return `T${newTransactionID.toString().padStart(2, '0')}`; // Example format: P01
    } catch (e) {
        console.error('Failed to generate transaction ID: ', e);
        throw new Error('Failed to generate transaction ID');
    }
}

async function handleCashPayment() {
    const totalPriceElement = document.getElementById('totalprice');
    const totalPrice = parseFloat(totalPriceElement.textContent.replace('RM ', ''));

    const cashPaidInput = document.getElementById('cash-paid-input');
    let cashPaid = parseFloat(cashPaidInput.value);

    if (!isNaN(cashPaid)) {
        const change = cashPaid - totalPrice;

        if (change < 0) {
            document.getElementById('change-message').textContent = `Insufficient cash. You need RM ${Math.abs(change).toFixed(2)} more.`;
        } else {
            document.getElementById('change-amount').textContent = `RM ${change.toFixed(2)}`;
            document.getElementById('change-message').textContent = '';
        }
    } else {
        document.getElementById('change-message').textContent = 'Please enter a valid cash amount.';
    }
}

document.getElementById('cash-paid-input').addEventListener('input', handleCashPayment);

const denominationButtons = document.querySelectorAll('#denomination-buttons button');

denominationButtons.forEach(button => {
    button.addEventListener('click', () => {
        const amount = parseFloat(button.getAttribute('data-amount'));
        const cashPaidInput = document.getElementById('cash-paid-input');
        cashPaidInput.value = amount.toFixed(2);

        handleCashPayment();
    });
});

async function checkMembership(pointsToAdd, pointsToRedeem) {
    const memberInfoDiv = document.getElementById('member-info');
    const memberId = sessionStorage.getItem('membershipId');

    memberInfoDiv.innerHTML = '';

    if (!memberId) {
        console.log("User is not a member.");
        memberInfoDiv.style.display = 'none';
        return { valid: false };
    }

    console.log("User is a member.");
    const usersCollection = collection(db, 'users');
    const q = query(usersCollection, where('membershipId', '==', memberId));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        console.log("No user found with this membership ID.");
        return { valid: false };
    }

    const userData = querySnapshot.docs[0].data();
    const currentPoints = userData.points || 0;
    let newPoints;

    if (!isNaN(pointsToAdd) && pointsToAdd > 0) {
        newPoints = currentPoints + pointsToAdd;
    } else if (!isNaN(pointsToRedeem) && pointsToRedeem > 0) {
        newPoints = currentPoints - pointsToRedeem;
    } else {
        newPoints = currentPoints;
    }

    console.log(`User points updated successfully. New points: ${newPoints}`);

    const memberTitleElem = document.createElement('h5');
    memberTitleElem.textContent = `Member Info`;
    memberTitleElem.classList.add('pb-3');
    memberInfoDiv.appendChild(memberTitleElem);

    const memberIdElem = document.createElement('p');
    memberIdElem.textContent = `Member Id: ${userData.membershipId}`;
    memberInfoDiv.appendChild(memberIdElem);

    const memberNameElem = document.createElement('p');
    memberNameElem.textContent = `Name: ${userData.name}`;
    memberInfoDiv.appendChild(memberNameElem);

    const memberEmailElem = document.createElement('p');
    memberEmailElem.textContent = `Email: ${userData.email}`;
    memberInfoDiv.appendChild(memberEmailElem);

    const memberPointsElem = document.createElement('p');
    memberPointsElem.id = 'member_points';
    memberPointsElem.textContent = `Points: ${newPoints}`;
    memberInfoDiv.appendChild(memberPointsElem);

    const redeemButton = document.createElement('button');
    redeemButton.id = 'redeem-points';
    redeemButton.textContent = 'Redeem Points';
    redeemButton.style.display = 'block';

    redeemButton.onclick = async function () {
        try {
            const membershipInfo = await checkMembership();

            if (membershipInfo.valid) {
                const { membershipId } = membershipInfo.memberDetails;

                const pointsToRedeemInput = document.getElementById('member_points');
                const pointsToRedeem = parseFloat(pointsToRedeemInput.textContent.replace('Points: ', ''));

                if (pointsToRedeem) {
                    await redeemPoints(membershipId, pointsToRedeem);
                } else {
                    displayMessage("No points to redeem.", "red");
                }
            } else {
                console.error("Membership is invalid or not found.");
                displayMessage("Invalid membership or no membership info available.", "red");
            }
        } catch (error) {
            console.error("Error redeeming points:", error);
            displayMessage("An error occurred. Please try again.", "red");
        }
    };

    memberInfoDiv.appendChild(redeemButton);

    memberInfoDiv.style.display = 'block';

    console.log("Member details:", userData);
    return { valid: true, memberDetails: userData };
}

async function updateMemberPoints(membershipId, pointsToAdd) {
    try {
        pointsToAdd = Number(pointsToAdd);
        if (isNaN(pointsToAdd) || pointsToAdd <= 0) {
            console.error('Invalid pointsToAdd value:', pointsToAdd);
            return;
        }

        const usersCollection = collection(db, 'users');
        const q = query(usersCollection, where('membershipId', '==', membershipId));
        console.log(`Query created to find user with membershipId: ${membershipId}`);
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            const userData = userDoc.data();
            const existingPoints = Number(userData.points) || 0;
            const newPoints = existingPoints + Number(pointsToAdd);

            console.log(`Current Points: ${existingPoints}, Points to Add: ${pointsToAdd}, New Points: ${newPoints}`);

            const userRef = doc(db, 'users', userDoc.id);
            console.log(`User reference created for document ID: ${userDoc.id}`);

            await updateDoc(userRef, { points: newPoints });
            console.log(`User points updated successfully for membershipId ${membershipId}. New points: ${newPoints}`);

            const memberInfoDiv = document.getElementById('member-info');
            if (memberInfoDiv) {
                memberInfoDiv.innerHTML = '';

                const pointsAdded = document.createElement('p');
                pointsAdded.textContent = `Points Added: ${pointsToAdd}`;
                memberInfoDiv.appendChild(pointsAdded);

                const balancePoints = document.createElement('p');
                balancePoints.textContent = `Updated Points Balance: ${newPoints}`;
                memberInfoDiv.appendChild(balancePoints);

                console.log(`Updated Points Info: ${JSON.stringify({ points: newPoints, AddedPoints: pointsToAdd })}`);
                return {
                    points: newPoints,
                    AddedPoints: pointsToAdd,
                };
            } else {
                console.warn('Member info element not found in the DOM.');
            }
        } else {
            console.warn("User not found with membershipId:", membershipId);
        }
    } catch (error) {
        console.error("Error updating member points:", error);
    }
}

async function redeemPoints(membershipId, pointsToRedeem) {
    try {
        const usersCollection = collection(db, 'users');
        const q = query(usersCollection, where('membershipId', '==', membershipId));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            const userData = userDoc.data();
            const currentPoints = Number(userData.points) || 0;
            const newPoints = 0;
            console.log(`Current Points: ${currentPoints}, Points to Redeem: ${pointsToRedeem}, New Points: ${newPoints}`);

            if (pointsToRedeem <= 0) {
                const modalMessage = document.getElementById('messageDiv');
                if (modalMessage) {
                    modalMessage.textContent = "No points to redeem.";
                    modalMessage.style.color = "red";
                }
                return;
            } else if (pointsToRedeem > currentPoints) {
                displayMessage("Insufficient points to redeem.", "red");
                return;
            }

            const redemptionRate = 1000;
            const pointsDiscount = currentPoints / redemptionRate;

            const userRef = doc(db, 'users', userDoc.id);
            await updateDoc(userRef, { points: newPoints });


            document.getElementById('messageDiv').textContent = "Points redeemed successfully.";
            document.getElementById('pointDiscount').textContent = `- RM ${pointsDiscount.toFixed(2)}`;


            const memberInfoDiv = document.getElementById('member-info');
            if (memberInfoDiv) {
                memberInfoDiv.innerHTML = '';

                const pointsRedeemed = document.createElement('p');
                pointsRedeemed.textContent = `Points Redeemed: ${pointsToRedeem}`;
                pointsRedeemed.id = 'pointsRedeemed';
                memberInfoDiv.appendChild(pointsRedeemed);

                const balancePoints = document.createElement('p');
                balancePoints.textContent = `Updated Points Balance: ${newPoints}`;
                memberInfoDiv.appendChild(balancePoints);
            }

            const subtotal = parseFloat(document.getElementById('Subtotal').textContent.replace(/[^0-9.-]+/g, ""));
            const salestaxRate = 0.10;
            const salestax = parseFloat(document.getElementById('salestax').textContent.replace(/[^0-9.-]+/g, ""));

            updateTotals(subtotal, salestaxRate);


            const discountedStaff = isStaff ? subtotal * (1 - discountRate) : subtotal;
            const discount = subtotal - discountedStaff;

            document.getElementById('Subtotal').textContent = `RM ${subtotal.toFixed(2)}`;
            document.getElementById('salestax').textContent = `RM ${salestax.toFixed(2)}`;
            document.getElementById('discount').textContent = `- RM ${discount.toFixed(2)}`;

            console.log("Points redeemed and discount applied successfully.");

            return { success: true, message: 'Points redeemed successfully', newPoints };

        } else {
            console.error("User document not found.");
            const modalMessage = document.getElementById('modal-message');
            if (modalMessage) {
                modalMessage.textContent = "User document not found.";
                modalMessage.style.color = "red";
            }
        }
    } catch (error) {
        console.error("Error redeeming points:", error);
        const modalMessage = document.getElementById('modal-message');
        if (modalMessage) {
            modalMessage.textContent = "Error redeeming points. Please try again.";
            modalMessage.style.color = "red";
        }
    }
}

document.getElementById('redeem-points').addEventListener('click', async () => {
    try {
        const membershipInfo = await checkMembership();

        if (membershipInfo.valid) {
            const { membershipId } = membershipInfo.memberDetails;

            const pointsToRedeemInput = document.getElementById('member_points');
            const pointsToRedeem = parseFloat(pointsToRedeemInput.textContent.replace('Points: ', ''));

            if (pointsToRedeem) {
                await redeemPoints(membershipId, pointsToRedeem);
            } else {
                displayMessage("No points to redeem.", "red");
            }
        } else {
            console.error("Membership is invalid or not found.");
            displayMessage("Invalid membership or no membership info available.", "red");
        }
    } catch (error) {
        console.error("Error redeeming points:", error);
        displayMessage("An error occurred. Please try again.", "red");
    }
});

async function calculatePoints(totalPrice) {
    const pointsPerRM = 1;
    return Math.floor(totalPrice * pointsPerRM);
}


function displayMessage(message, color) {
    const messageDiv = document.getElementById('messageDiv');
    messageDiv.textContent = message;
    messageDiv.style.color = color;
}

document.getElementById('cash-payment').addEventListener('click', async () => {
    try {
        const changeElement = document.getElementById('change-amount');
        const changes = parseFloat(changeElement.textContent.replace('RM ', ''));

        const pointsToRedeemElement = document.getElementById('pointsRedeemed');
        let pointsToRedeem = 0;

        if (pointsToRedeemElement) {
            const textContent = pointsToRedeemElement.textContent.replace('Points Redeemed: ', '');
            pointsToRedeem = parseInt(textContent);
            console.log('Parsed points to redeem:', pointsToRedeem);
        } else {
            console.error('pointsRedeemed element not found');
        }

        const pointDiscountElement = document.getElementById('pointDiscount');
        const pointDiscount = parseFloat(pointDiscountElement.textContent.replace('RM ', ''));

        const totalPriceElement = document.getElementById('totalprice');
        const totalPrice = parseFloat(totalPriceElement.textContent.replace('RM ', ''));

        const subtotalElement = document.getElementById('Subtotal');
        const subtotal = parseFloat(subtotalElement.textContent.replace('RM ', ''));

        const salesTaxElement = document.getElementById('salestax');
        const salesTax = parseFloat(salesTaxElement.textContent.replace('RM ', ''));

        const discountElement = document.getElementById('discount');
        const discount = parseFloat(discountElement.textContent.replace('RM ', ''));

        const cashPaidInput = document.getElementById('cash-paid-input');
        let cashPaid = parseFloat(cashPaidInput.value);
        const change = cashPaid - totalPrice;

        if (!isNaN(cashPaid) && change >= 0) {

            const membershipInfo = await checkMembership();
            console.log('Membership Info:', membershipInfo);

            const memberDetails = membershipInfo && membershipInfo.memberDetails;

            const userId = getCurrentUserId();

            if (userId) {
                const cartItems = await getCartData(userId);
                const transactionId = await generateTransactionID();

                if (membershipInfo.valid) {
                    if (!memberDetails) {
                        console.error('Member details are not available.');
                        return;
                    }

                    let pointsToAdd = await calculatePoints(totalPrice);
                    console.log(`Points to Add before update: ${pointsToAdd}`);

                    await updateMemberPoints(memberDetails.membershipId, pointsToAdd);

                    if (!isNaN(pointsToRedeem) && pointsToRedeem > 0) {
                        const redemptionResult = await redeemPoints(memberDetails.membershipId, pointsToRedeem);
                        console.log(`Points Redeemed Result: ${JSON.stringify(redemptionResult)}`);

                        if (redemptionResult && redemptionResult.success) {
                            pointsToAdd = await calculatePoints(totalPrice);
                            await updateMemberPoints(memberDetails.membershipId, pointsToAdd);
                            console.log(`Updated Member Points after Redemption: ${pointsToAdd}`);
                        } else {
                            console.error(`Failed to redeem points: ${redemptionResult ? redemptionResult.error : 'Unknown error'}`);
                        }

                        for (let item of cartItems) {
                            await updateProductStock(item.id, item.quantity, item.category, item.type);
                        }

                        await clearCart(userId);
                        sessionStorage.removeItem('memberName');
                        sessionStorage.removeItem('membershipId');

                    } else {
                        for (let item of cartItems) {
                            await updateProductStock(item.id, item.quantity, item.category, item.type);
                        }

                        await clearCart(userId);
                        sessionStorage.removeItem('memberName');
                        sessionStorage.removeItem('membershipId');
                        console.log(`No points to redeem or invalid value.`);
                    }

                    const updatedMemberDetails = {
                        ...memberDetails,
                        points: memberDetails.points + pointsToAdd,
                        AddedPoints: pointsToAdd,
                        RedeemedPoints: pointsToRedeem,
                    };

                    await savePaymentDetails(
                        transactionId,
                        cartItems,
                        cashPaid,
                        subtotal,
                        salesTax,
                        discount,
                        pointDiscount,
                        totalPrice,
                        changes,
                        updatedMemberDetails
                    );

                    console.log('Updated Member Details:', updatedMemberDetails);

                } else {
                    console.log("Proceeding without membership points or details for a non-member.");
                    const transactionId = await generateTransactionID();
                    for (let item of cartItems) {
                        await updateProductStock(item.id, item.quantity, item.category, item.type);
                    }

                    await clearCart(userId);
                    sessionStorage.removeItem('memberName');
                    sessionStorage.removeItem('membershipId');
                    console.log(`No points to redeem or invalid value.`);

                    await savePaymentDetails(
                        transactionId,
                        cartItems,
                        cashPaid,
                        subtotal,
                        salesTax,
                        discount,
                        pointDiscount,
                        totalPrice,
                        changes,
                        null
                    );
                    window.alert("Payment Successfully.");
                    window.location.href = "../staff/staff-sales.html";
                }

            } else {
                document.getElementById('change-message').textContent = 'You need to be a member to earn points.';
            }
        } else {
            document.getElementById('change-message').textContent = 'Please enter a valid cash amount.';
        }
    } catch (error) {
        console.error("Error processing cash payment:", error);
    }
});

let isEmailSent = false;

async function savePaymentDetails(transactionId, cartItems, cashPaid, subtotal, salesTax, discount, pointDiscount, totalPrice, changes, updatedMemberDetails) {
    try {

        const discountElement = document.getElementById('discount');
        let discountText = discountElement.textContent.replace('RM ', '');
        discountText = discountText.replace('-', '').trim();
        discount = parseFloat(discountText);
        discount = isNaN(discount) ? 0 : discount;

        const pointDiscountElement = document.getElementById('pointDiscount');
        let pointDiscountText = pointDiscountElement.textContent.replace('RM ', '');
        pointDiscountText = pointDiscountText.replace('-', '').trim();
        pointDiscount = parseFloat(pointDiscountText);
        pointDiscount = isNaN(pointDiscount) ? 0 : pointDiscount;

        const paymentRef = doc(collection(db, 'orders'), transactionId);

        const paymentData = {
            transactionId: transactionId,
            cartItems: cartItems,
            paymentDate: new Date().toISOString(),
            method: 'cash',
            amountPaid: cashPaid,
            subtotal: subtotal,
            discount: discount,
            salesTax: salesTax,
            pointDiscount: pointDiscount,
            totalPrice: totalPrice,
            change: changes,
            memberDetails: updatedMemberDetails || null,
        };

        console.log("Payment Data to be saved:", paymentData);
        await setDoc(paymentRef, paymentData);

        if (updatedMemberDetails) {

            if (isEmailSent) {
                console.log("Email has already been sent.");
                return;
            } else if (!isEmailSent) {
                console.log("Email has not been sent.");
                isEmailSent = true;
                await sendEmailNotificationOnSuccess(paymentData);
                window.alert("Email has been sent.");
                window.location.href = "../staff/staff-sales.html";
            }

        }

    } catch (error) {
        console.error("Error saving payment details:", error);
    }
}

async function clearCart(userId) {
    try {
        const cartRef = doc(collection(db, 'carts'), userId);
        await setDoc(cartRef, { cart: [] });
        console.log("Cart cleared successfully.");
    } catch (error) {
        console.error("Error clearing cart:", error);
    }
}

async function updateProductStock(id, quantity, category, type) {
    try {

        console.log('Product ID:', id);
        console.log('Category:', category);
        console.log('Subcategory:', type);

        if (!id || !category || !type) {
            throw new Error('Invalid product details');
        }

        const productRef = doc(db, 'product', category, type, id);

        const productDoc = await getDoc(productRef);
        if (!productDoc.exists()) {
            console.error('Product not found:', id);
            return;
        }

        const productData = productDoc.data();
        const currentStock = productData.product_stock || 0;

        const newStock = currentStock - quantity;
        if (newStock < 0) {
            console.error('Insufficient stock for product:', id);
            return;
        }

        await updateDoc(productRef, { product_stock: newStock });
        console.log('Stock updated for product:', id);

    } catch (error) {
        console.error('Error updating product stock:', error);
    }
}

//Send Email Function
async function sendEmailNotificationOnSuccess(paymentData) {
    try {

        const date = new Date().toISOString();
        console.log('Received paymentData:', paymentData);

        const memberDetails = paymentData.memberDetails || {};
        console.log('Member Details for email:', memberDetails);

        const receiptResponse = await fetch('/generate-receipt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ paymentData, memberDetails })
        });

        if (!receiptResponse.ok) throw new Error('Failed to generate receipt');

        const { receiptUrl } = await receiptResponse.json();
        console.log('Generated Receipt URL:', receiptUrl);

        const emailResponse = await emailjs.send('service_wzr9j6h', 'template_desg8ei', {
            email: memberDetails.email,
            subject: 'Payment Details',
            date: date,
            name: memberDetails.name,
            id: memberDetails.membershipId,
            transaction_id: paymentData.transactionId,
            point: memberDetails.points,
            pointRedeemed: memberDetails.RedeemedPoints,
            pointsAdded: memberDetails.AddedPoints,
            cart_items: paymentData.cartItems,
            cash_paid: paymentData.amountPaid,
            subtotal: paymentData.subtotal,
            sales_tax: paymentData.salesTax,
            discount: paymentData.discount,
            point_discount: paymentData.pointDiscount,
            total_price: paymentData.totalPrice,
            changes: paymentData.change,
            paymentDate: paymentData.paymentDate,
            receipt_url: receiptUrl,
        });

        console.log('Email sent successfully to:', paymentData.memberDetails.email);
        console.log('Response status:', emailResponse.status);
    } catch (error) {
        console.error('Error sending email:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    checkMembership();
});

displayCartItems();
