import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'; // Import necessary AWS SDK packages

// Initialize DynamoDB Client
const dynamoDbClient = new DynamoDBClient({ region: 'us-east-1' }); // Update with your region

// Lambda handler function
export async function handler(event) {
    const body = JSON.parse(event.body);

    const { Name, Category, Description, Cost, Quantity } = body;

    // Validate that all required fields are present
    if (!Name || !Category || !Description || !Cost || !Quantity) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                message: 'Missing required fields',
                request: body
            }),
        };
    }

    // Prepare the item to insert into DynamoDB
    const params = {
        TableName: 'inventory-v2', // DynamoDB table name
        Item: {
            Name: { S: Name },
            Category: { S: Category },
            Description: { S: Description },
            Cost: { N: Cost.toString() }, // Cost should be a number, converting it to string
            Quantity: { N: Quantity.toString() }, // Quantity should be a number, converting it to string
        },
    };

    // Upload the item to DynamoDB
    const command = new PutItemCommand(params);

    let result;
    try {
        result = await dynamoDbClient.send(command);
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Item successfully uploaded to inventory!',
                returned: result
            }),
        };
    } catch (err) {
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'client.send failed',
                error: err,
                returned: result
            }),
        };
    }
}
