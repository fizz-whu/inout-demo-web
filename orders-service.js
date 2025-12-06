// Orders API Service

class OrdersService {
    constructor() {
        // Use the same base URL as iOS app
        this.baseURL = 'https://g7xd1zgfel.execute-api.us-west-2.amazonaws.com/prod';
    }

    // Fetch all orders from the API
    async fetchAllOrders() {
        const url = `${this.baseURL}/orders`;

        console.log(`Fetching all orders from: ${url}`);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            console.log(`Response status code: ${response.status}`);

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            const data = await response.json();
            console.log('Raw response:', data);

            console.log(`Successfully fetched ${data.orders.length} orders`);
            return data.orders;

        } catch (error) {
            console.error('Error fetching all orders:', error);
            throw error;
        }
    }

    // Fetch a specific order by ID
    async fetchOrder(orderId) {
        const url = `${this.baseURL}/orders/${orderId}`;

        console.log(`Fetching order ${orderId} from: ${url}`);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            console.log(`Response status code: ${response.status}`);

            if (response.status === 404) {
                throw new Error(`Order not found: ${orderId}`);
            }

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            const data = await response.json();
            console.log('Raw response:', data);

            console.log(`Successfully fetched order: ${orderId}`);
            return data;

        } catch (error) {
            console.error(`Error fetching order ${orderId}:`, error);
            throw error;
        }
    }

    // Convert API response to Order object for display
    convertToOrder(apiResponse) {
        // Parse timestamp
        const timestamp = new Date(apiResponse.timestamp);

        // Convert items array to string
        const itemsText = apiResponse.items.map(item => {
            if (item.quantity > 1) {
                return `${item.quantity}x ${item.name}`;
            } else {
                return item.name;
            }
        }).join(', ');

        // Format price
        const priceText = `$${apiResponse.totalPrice.toFixed(2)}`;

        // Determine if paid
        const isPaid = (apiResponse.paymentStatus?.toLowerCase() === 'paid') ||
                      (apiResponse.status.toLowerCase() === 'completed');

        // Extract order number from orderId
        let orderNumber;
        const parts = apiResponse.orderId.split('-');
        if (parts.length > 0) {
            orderNumber = `#${parts[0]}`;
        } else {
            orderNumber = `#${apiResponse.orderId.substring(apiResponse.orderId.length - 4)}`;
        }

        return {
            id: apiResponse.orderId,
            orderNumber: orderNumber,
            items: itemsText,
            price: priceText,
            timestamp: timestamp,
            isPaid: isPaid,
            orderId: apiResponse.orderId
        };
    }

    // Format time for display
    formatTime(date) {
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }
}

// Export OrdersService
window.OrdersService = OrdersService;
