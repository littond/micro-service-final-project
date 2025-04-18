import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'; // Import necessary AWS SDK packages

// Initialize DynamoDB Client
const dynamoDbClient = new DynamoDBClient({ region: 'us-east-1' }); // Update with your region

// Lambda handler function
export async function handler(event) {
    try {
        // Parse the incoming request body
        const body = JSON.parse(event.body);

        // Extract fields from the body
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
            TableName: 'inventory', // DynamoDB table name
            Item: {
                Name: { S: Name },
                Category: { S: Category },
                Description: { S: Description },
                Cost: { N: Cost.toString() }, // Cost should be a number, converting it to string
                Quantity: { N: Quantity.toString() }, // Quantity should be a number, converting it to string
                Timestamp: { S: new Date().toISOString() }, // Add a timestamp field for reference
            },
        };

        // Upload the item to DynamoDB
        const command = new PutItemCommand(params);
        await dynamoDbClient.send(command);

        // Return a success response
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Item successfully uploaded to inventory!',
                item: { Name, Category, Description, Cost, Quantity },
            }),
        };
    } catch (error) {
        // Handle errors and return a 500 response
        console.error('Error processing the request:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal Server Error', error: error.message }),
        };
    }
}
