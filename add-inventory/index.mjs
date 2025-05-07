import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'; // Import necessary AWS SDK packages
const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",                           // or your exact origin
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT"
};
// Initialize DynamoDB Client
const dynamoDbClient = new DynamoDBClient({ region: 'us-east-1' }); // Update with your region

// Lambda handler function
export async function handler(event) {
    const body = JSON.parse(event.body);

    const { product, category, description, cost, quantity } = body;

    // Validate that all required fields are present
    if (!product || !category || !description || !cost || !quantity) {
        return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                message: 'Missing required fields',
                request: body
            }),
        };
    }

    // Prepare the item to insert into DynamoDB
    const params = {
        TableName: 'inventory', // DynamoDB table name
        Item: {
            product: { S: product },
            quantity: { N: quantity.toString() }, // Quantity should be a number, converting it to string
        },
    };

    // Upload the item to DynamoDB
    const command = new PutItemCommand(params);

    let result;
    try {
        result = await dynamoDbClient.send(command);
        const params2 = {
            TableName: 'catalog', // DynamoDB table name
            Item: {
                product: { S: product },
                category: { S: category },
                description: { S: description },
                cost: { N: cost.toString() }, // Cost should be a number, converting it to string
            },
        };
        const command2 = new PutItemCommand(params2);
        result = await dynamoDbClient.send(command2);
        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                message: 'Item successfully uploaded to inventory!',
                returned: result
            }),
        };
    } catch (err) {
        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                message: 'client.send failed',
                error: err,
                returned: result
            }),
        };
    }
}