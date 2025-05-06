import { DynamoDBClient, PutItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';  // follows your existing pattern :contentReference[oaicite:0]{index=0}:contentReference[oaicite:1]{index=1}
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const REGION = 'us-east-1';
const dynamoDbClient = new DynamoDBClient({ region: REGION });
const sqsClient = new SQSClient({ region: REGION });
const URL = 'https://sqs.us-east-1.amazonaws.com/557690622184/inventory-check-queue';

export async function handler(event) {
    let body;
    try {
        body = JSON.parse(event.body);
    } catch {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'Invalid JSON payload' }),
        };
    }


    const { product, quantity } = body;
    if (!product || typeof quantity !== 'number') {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'Missing or invalid `product` or `quantity`' }),
        };
    }

    console.log("request is valid", "product: ", product, "quantity: ", quantity);

    // 1) Log order to DynamoDB
    const orderId = Date.now().toString();
    const putParams = {
        TableName: 'orders',
        Item: {
            orderId: { S: orderId },
            product: { S: product },
            quantity: { N: quantity.toString() },
            orderDate: { S: new Date().toISOString() },
        },
    };

    try {
        await dynamoDbClient.send(new PutItemCommand(putParams));
        console.log("sent order to order table");
    } catch (dbErr) {
        console.error('DynamoDB error', dbErr);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Failed to record order' }),
        };
    }

    // 2) Decrement inventory
    try {
        // a) Fetch the current stock
        const { Item } = await dynamoDbClient.send(new GetItemCommand({
            TableName: 'inventory',
            Key: { product: { S: product } }
        }));

        const row = Item;

        console.log("found row:", row);

        if (!row.product || !row.quantity) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: 'Product not found in inventory' })
            };
        }

        const currentStock = parseInt(row.quantity.N, 10);
        console.log('currentStock: ', currentStock);
        if (currentStock < quantity) {
            return {
                statusCode: 409,
                body: JSON.stringify({ message: 'Insufficient inventory' })
            };
        }

        // b) Compute the new stock value
        const newStock = currentStock - quantity;
        console.log('newStock: ', newStock);

        // c) Write it back with PutItem
        await dynamoDbClient.send(new PutItemCommand({
            TableName: 'inventory',
            Item: {
                product: { S: product },
                quantity: { N: newStock.toString() }
                // … include any other attributes you need to preserve …
            }
        }));

    } catch (err) {
        console.error('Inventory update error:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Error updating inventory' })
        };
    }

    // 3) Send SQS message with the product
    const msgParams = {
        QueueUrl: URL,
        MessageBody: JSON.stringify({ product }),
    };

    try {
        await sqsClient.send(new SendMessageCommand(msgParams));
        console.log("sent sqs message");
    } catch (sqsErr) {
        console.error('SQS error', sqsErr);
        // You might decide whether to treat this as fatal or retry…
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Order recorded but failed to enqueue notification' }),
        };
    }

    // 3) Return success
    return {
        statusCode: 200,
        body: JSON.stringify({ success: true, orderId }),
    };
}
