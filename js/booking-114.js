import { getFirestore, collection, setDoc, doc, getDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', function () {

  const db = getFirestore();
  const auth = getAuth();

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
        fetchUserDataFromFirestore(userId);
        // await fetchUserPayments(userId);
        await initCalendar(userId);
        console.log("User authenticated. User ID:", userId);
      } else {
      }
    } catch (error) {
      console.error("Error in authentication state change:", error);
    }
  });

  // Retrieve selected room name from sessionStorage
  const selectedRoomName = sessionStorage.getItem('selectedRoomName');
  const selectedRoomPrice = sessionStorage.getItem('selectedRoomPrice');
  const selectedRoomCategory = sessionStorage.getItem('selectedRoomCategory');

  document.getElementById('room_name').value = selectedRoomName;
  document.getElementById('price').textContent = selectedRoomPrice;
  document.getElementById('category').value = selectedRoomCategory;

  async function checkRoomAvailability(date) {
    try {
      const roomCategories = [
        { category: 'cat', collectionName: 'cat rooms' },
        { category: 'dog', collectionName: 'dog rooms' },
        { category: 'rabbit', collectionName: 'rabbit rooms' },
        { category: 'cage', collectionName: 'cage rooms' },
      ];

      for (const { category, collectionName } of roomCategories) {
        const docRef = doc(collection(db, 'rooms'), category);
        const roomCollectionRef = collection(docRef, collectionName);
        const roomQuerySnapshot = await getDocs(roomCollectionRef);

        for (const docSnap of roomQuerySnapshot.docs) {
          if (docSnap.exists()) {
            const room = docSnap.data();
            const roomQuantities = room.room_quantity || [];

            // Check availability for the specific date
            for (const monthData of roomQuantities) {
              for (const [roomDate, quantity] of Object.entries(monthData)) {
                const availableDate = new Date(roomDate);
                if (availableDate.toDateString() === new Date(date).toDateString() &&
                  parseInt(quantity, 10) > 0) {
                  return true; // Room is available
                }
              }
            }
          }
        }
      }

      return false; // No rooms available
    } catch (error) {
      console.error('Error checking room availability:', error);
      return false;
    }
  }

  function calculateNights(checkinDate, checkoutDate) {
    if (!checkinDate || !checkoutDate) return 0;

    const checkin = new Date(checkinDate);
    const checkout = new Date(checkoutDate);

    if (checkout <= checkin) return 0;

    const timeDiff = checkout - checkin;
    const dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    return dayDiff;
  }

  // function calculateTotalPrice(nights, roomPrice) {
  //   return nights * roomPrice;
  // }

  // function calculateServiceTax(amount, taxRate = 6) {
  //   return amount * (taxRate / 100);
  // }

  // function calculateSalesTax(amount, taxRate = 10) {
  //   return amount * (taxRate / 100);
  // }

  function calculateTotalCost(nights, roomPrice, serviceTaxRate = 6, salesTaxRate = 10) {
    const basePrice = nights * roomPrice;
    const serviceTax = basePrice * (serviceTaxRate / 100);
    const salesTax = basePrice * (salesTaxRate / 100);
    const totalPrice = basePrice + serviceTax + salesTax;

    return { basePrice, serviceTax, salesTax, totalPrice };
  }

  async function updateTotalPrice() {
    const checkinDate = checkinElem.value;
    const checkoutDate = checkoutElem.value;
    const nights = calculateNights(checkinDate, checkoutDate);

    // Ensure priceElem has a valid format
    const priceText = priceElem ? priceElem.textContent.replace('RM ', '').trim() : '0';
    const roomPrice = parseFloat(priceText) || selectedRoomPrice; // Fallback to selectedRoomPrice if parseFloat fails

    document.querySelectorAll('.error').forEach(el => el.textContent = '');
    // Check room availability
    const isCheckinAvailable = await checkRoomAvailability(checkinDate);
    const isCheckoutAvailable = await checkRoomAvailability(checkoutDate);

    // Determine overall availability
    const isAvailable = isCheckinAvailable && isCheckoutAvailable;
    const isSameDay = new Date(checkinDate).toDateString() === new Date(checkoutDate).toDateString();
    const validNights = isAvailable && !isSameDay ? nights : 0;

    // Calculate subtotal and totalPrice
    let subtotal = isAvailable && !isSameDay ? roomPrice : 0;
    subtotal = parseFloat(subtotal) || 0;

    const { basePrice, serviceTax, salesTax, totalPrice: calculatedTotalPrice } = isAvailable && validNights > 0
      ? calculateTotalCost(validNights, roomPrice)
      : { basePrice: 0, serviceTax: 0, salesTax: 0, totalPrice: 0 };


    // Update elements with appropriate values
    if (priceElem) {
      priceElem.textContent = `${subtotal.toFixed(2)}`;
    } else {
      console.error('Price element not found');
    }

    if (subtotalElem) {
      subtotalElem.textContent = `${basePrice.toFixed(2)}`;
    } else {
      console.error('Subtotal element not found');
    }

    if (nightsElem) {
      nightsElem.textContent = `${validNights}`;
    } else {
      console.error('Nights element not found');
    }

    if (serviceElem) {
      service.textContent = `${serviceTax.toFixed(2)}`;
    } else {
      console.error('Nights element not found');
    }

    if (salesElem) {
      sales.textContent = `${salesTax.toFixed(2)}`;
    } else {
      console.error('Nights element not found');
    }

    if (totalPriceElem) {
      totalPriceElem.textContent = `${calculatedTotalPrice.toFixed(2)}`;
    } else {
      console.error('Total Price element not found');
    }

    if (!isCheckinAvailable && !isCheckoutAvailable) {
      document.getElementById('available_error').textContent = 'Sorry, no rooms are available for the selected dates.';
      document.getElementById('available_error').style.display = 'block';
    } else if (!isCheckinAvailable) {
      document.getElementById('available_error').textContent = 'Sorry, no rooms are available for checkin date.';
      document.getElementById('available_error').style.display = 'block';
    } else if (!isCheckoutAvailable) {
      document.getElementById('available_error').textContent = 'Sorry, no rooms are available for checkout date.';
      document.getElementById('available_error').style.display = 'block';
    } else {
      document.getElementById('available_error').textContent = '';
      document.getElementById('available_error').style.display = 'none';
    }
  }

  // Initialize date variables
  var currentDateTime = new Date();
  var year = currentDateTime.getFullYear();
  var month = (currentDateTime.getMonth() + 1).toString().padStart(2, '0');
  var date = currentDateTime.getDate().toString().padStart(2, '0');
  var todayDate = `${year}-${month}-${date}`;

  var dateTomorrow = new Date();
  dateTomorrow.setDate(dateTomorrow.getDate() + 1);
  var yearTomorrow = dateTomorrow.getFullYear();
  var monthTomorrow = (dateTomorrow.getMonth() + 1).toString().padStart(2, '0');
  var dateTomorrowFormatted = `${yearTomorrow}-${monthTomorrow}-${dateTomorrow.getDate().toString().padStart(2, '0')}`;

  var checkinElem = document.querySelector("#checkin");
  var checkoutElem = document.querySelector("#checkout");
  var priceElem = document.getElementById('price');
  var nightsElem = document.getElementById('nights');
  var serviceElem = document.getElementById('service');
  var salesElem = document.getElementById('sales');
  var subtotalElem = document.getElementById('subtotal');
  var totalPriceElem = document.getElementById('totalprice');

  if (checkinElem && checkoutElem) {
    checkinElem.setAttribute("min", dateTomorrowFormatted);
    checkinElem.value = dateTomorrowFormatted;

    var defaultCheckoutDate = new Date();
    defaultCheckoutDate.setDate(defaultCheckoutDate.getDate() + 2);
    var yearDefault = defaultCheckoutDate.getFullYear();
    var monthDefault = (defaultCheckoutDate.getMonth() + 1).toString().padStart(2, '0');
    var dateDefault = defaultCheckoutDate.getDate().toString().padStart(2, '0');
    var defaultCheckoutDateFormatted = `${yearDefault}-${monthDefault}-${dateDefault}`;

    checkoutElem.setAttribute("min", dateTomorrowFormatted);
    checkoutElem.value = defaultCheckoutDateFormatted;

    checkinElem.onchange = async function () {
      checkoutElem.setAttribute("min", this.value);
      await updateTotalPrice();
    }

    checkoutElem.addEventListener('change', async function () {
      await updateTotalPrice();
    });

    // Call updateTotalPrice when the page loads to set initial values
    updateTotalPrice();
  } else {
    console.error('Check-in or Check-out elements not found');
  }

  async function generateBookingID() {
    const bookingCounterDocRef = doc(db, 'metadata', 'bookingCounter');
    try {
      const bookingCounterDoc = await getDoc(bookingCounterDocRef);
      let newBookingID = 1;
      if (bookingCounterDoc.exists()) {
        newBookingID = bookingCounterDoc.data().lastBookingID + 1;
      }
      await setDoc(bookingCounterDocRef, { lastBookingID: newBookingID });
      return `B${newBookingID.toString().padStart(2, '0')}`; // Example format: P00001
    } catch (e) {
      console.error('Failed to generate booking ID: ', e);
      throw new Error('Failed to generate booking ID');
    }
  }

  async function fetchUserDataFromFirestore(userId) {
    try {
      if (userId) {
        const usersCollectionRef = collection(db, 'users');
        const querySnapshot = await getDocs(query(usersCollectionRef, where('userId', '==', userId)));

        querySnapshot.forEach((doc) => {
          const userData = doc.data();
          document.getElementById('owner_name').value = userData.name || '';
          document.getElementById('email').value = userData.email || '';
          document.getElementById('contact').value = userData.contact || '';
        });
      }
    } catch (e) {
      console.error('Error fetching user data: ', e);
    }
  }

  // Inside the click event listener for the submit button
  document.getElementById("submit").addEventListener("click", async () => {
    try {
      const userId = getCurrentUserId();

      // Clear previous error messages
      document.querySelectorAll('.error').forEach(el => el.textContent = '');

      // Get form values
      const roomName = document.getElementById('room_name').value;
      const checkinDate = document.getElementById('checkin').value;
      const checkoutDate = document.getElementById('checkout').value;
      const ownerName = document.getElementById('owner_name').value;
      const petName = document.getElementById('pet_name').value;
      const email = document.getElementById('email').value;
      const contact = document.getElementById('contact').value;
      const category = document.getElementById('category').value;
      const foodCategory = document.getElementById('food_category').value;
      const roomPrice = document.getElementById('price').textContent;
      const status = document.getElementById('status').value;
      const bookingId = await generateBookingID();
      const imageInput = document.getElementById('vaccination_image');
      const imagePath = imageInput ? imageInput.value : '';
      const imageName = imagePath.split(/[/\\]/).pop();
      const nights = calculateNights(checkinDate, checkoutDate);
      const subtotal = document.getElementById('subtotal').textContent;
      const service = document.getElementById('service').textContent;
      const sales = document.getElementById('sales').textContent;
      const totalPrice = document.getElementById('totalprice').textContent;

      // Validate inputs
      let isValid = true;

      if (!roomName) {
        document.getElementById('name_error').textContent = 'Please select the room from the Dog, Cat, Rabbit, or Cage page.';
        isValid = false;
      }
      if (!checkinDate) {
        document.getElementById('checkin_error').textContent = 'Please select a check-in date.';
        isValid = false;
      }
      if (!checkoutDate) {
        document.getElementById('checkout_error').textContent = 'Please select a checkout date.';
        isValid = false;
      }
      if (!ownerName) {
        document.getElementById('owner_error').textContent = 'Please fill in owner name.';
        isValid = false;
      }
      if (!petName) {
        document.getElementById('pet_error').textContent = 'Please fill in pet name.';
        isValid = false;
      }
      if (!email) {
        document.getElementById('email_error').textContent = 'Please fill in your email.';
        isValid = false;
      }
      if (!contact) {
        document.getElementById('contact_error').textContent = 'Please fill in your contact number.';
        isValid = false;
      }
      if (!category) {
        document.getElementById('category_error').textContent = 'Please select one of the animal categories.';
        isValid = false;
      }
      if (!foodCategory) {
        document.getElementById('food_error').textContent = 'Please select a food category.';
        isValid = false;
      }
      if (!imageName) {
        document.getElementById('vaccination_error').textContent = 'Please upload a file.';
        isValid = false;
      } else {
        const fileExtension = imageName.split('.').pop().toLowerCase();
        const allowedExtensions = ['pdf', 'png', 'jpg', 'jpeg'];
        if (!allowedExtensions.includes(fileExtension)) {
          document.getElementById('vaccination_error').textContent = 'Please upload a file with one of the following file types: PDF, PNG, JPG, JPEG.';
          isValid = false;
        }
      }

      // Stop further processing if validation fails
      if (!isValid) {
        window.alert("Please fill in all required fields.");
        return;
      }

      // Create or update a document within the "bookings" collection using the userId as the document ID
      const userDocRef = doc(db, 'book', userId);

      // Fetch the current data from Firestore
      const docSnap = await getDoc(userDocRef);
      let bookingsArray = [];

      if (docSnap.exists()) {
        // If the document exists, fetch its current data and update it
        const userData = docSnap.data();
        bookingsArray = userData.bookings || [];
      }

      // Construct new booking object
      const newBooking = {
        book_id: bookingId,
        book_date: new Date().toISOString(),
        room_name: roomName,
        checkin_date: checkinDate,
        checkout_date: checkoutDate,
        owner_name: ownerName,
        pet_name: petName,
        email: email,
        contact: contact,
        category: category,
        food_category: foodCategory,
        vaccination_image: imageName,
        price: roomPrice,
        status: status,
        nights: nights,
        serviceTax: service,
        salesTax: sales,
        subtotal: subtotal,
        totalPrice: totalPrice
      };

      // Add the new booking to the array
      bookingsArray.push(newBooking);

      // Update the document in Firestore with the updated bookings array
      await setDoc(userDocRef, { bookings: bookingsArray }, { merge: true });

      console.log('Booking added to array in Firestore for user ID:', userId);
      // After successful booking addition, navigate to payment page
      console.log('Navigating to payment page...');
      window.location.href = "../html/payment.html";
    } catch (e) {
      console.error('Error saving booking details:', e);
      console.log('Error saving booking details: ' + e.message);
    }
  });

  // Define the function to fetch user payments
  async function fetchRoomQuantity(year = new Date().getFullYear()) {
    try {
      const roomCategories = [
        { category: 'cat', collectionName: 'cat rooms' },
        { category: 'dog', collectionName: 'dog rooms' },
        { category: 'rabbit', collectionName: 'rabbit rooms' },
        { category: 'cage', collectionName: 'cage rooms' },
      ];

      const roomData = [];

      for (const { category, collectionName } of roomCategories) {
        const docRef = doc(collection(db, 'rooms'), category);
        const roomCollectionRef = collection(docRef, collectionName);
        const roomQuerySnapshot = await getDocs(roomCollectionRef);

        roomQuerySnapshot.forEach(docSnap => {
          if (docSnap.exists()) {
            const room = docSnap.data();
            const roomName = room.room_name || 'Unknown';
            const roomQuantities = room.room_quantity || []; // Array of maps

            // Process data for each month
            roomQuantities.forEach((monthData, monthIndex) => {
              for (const [date, quantity] of Object.entries(monthData)) {
                const roomDate = new Date(date);
                if (roomDate.getFullYear() === year) {
                  roomData.push({
                    category,
                    roomName,
                    date: date, // Store date as string
                    quantity: parseInt(quantity, 10),
                    month: roomDate.getMonth(), // Store month index for filtering
                  });
                }
              }
            });
          }
        });
      }

      console.log('Fetched room data:', roomData);
      return roomData;
    } catch (error) {
      console.error('Error fetching room quantity:', error);
      return [];
    }
  }
  async function initCalendar() {
    const calendarEl = document.getElementById('calendar');

    const calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: 'dayGridMonth',
      initialDate: new Date().toISOString().split('T')[0],
      events: [], // No events to show
      validRange: {
        start: new Date().getFullYear() + '-01-01', // Start of the year
        end: new Date().getFullYear() + '-12-31'   // End of the year
      },
      dayCellDidMount: async function (info) {
        const cellDate = new Date(info.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const nextDay = new Date(today);
        nextDay.setDate(today.getDate() + 1);

        if (cellDate >= nextDay) {
          const cell = info.el.querySelector('.fc-daygrid-day-frame');
          if (cell) {
            const roomData = await fetchRoomQuantity(); // Fetch room data

            const filterContainer = document.createElement('div');
            filterContainer.className = 'filter-controls';
            filterContainer.innerHTML = `
              <button data-category="dog">Dog</button>
              <button data-category="cat">Cat</button>
              <button data-category="rabbit">Rabbit</button>
              <button data-category="cage">Cage</button>
            `;

            cell.appendChild(filterContainer);

            filterContainer.querySelectorAll('button').forEach(button => {
              button.addEventListener('click', function () {
                const category = this.getAttribute('data-category');
                filterRoomData(category, roomData, cellDate.getDate(), cellDate.getMonth());
              });
            });
          }
        }
      }
    });

    function filterRoomData(category, roomData, day, month) {
      const filteredData = roomData.filter(room => {
        const roomDate = new Date(room.date);
        return roomDate.getDate() === day && roomDate.getMonth() === month && (category === 'all' || room.category === category);
      });
      console.log('Filtered room data:', filteredData);
      displayRoomDetails(filteredData);
    }

    function displayRoomDetails(roomData) {
      const modalTitle = document.getElementById('eventModalLabel');
      const modalBody = document.querySelector('#eventModal .modal-body');

      let modalContent = '<ul>';
      roomData.forEach(room => {
        modalContent += `
          <li>
            <strong>Room Name:</strong> ${room.roomName}<br>
            <strong>Quantity:</strong> ${room.quantity}
          </li>
        `;
      });
      modalContent += '</ul>';

      modalTitle.textContent = `Room Details`;
      modalBody.innerHTML = modalContent;

      // Show the modal
      const eventModal = new bootstrap.Modal(document.getElementById('eventModal'));
      eventModal.show();
    }

    calendar.render();
  }

  document.addEventListener('DOMContentLoaded', function () {
    initCalendar();
  });

});