import {
    DynamoDBClient,
    ScanCommand,
    QueryCommand
} from "@aws-sdk/client-dynamodb";
const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",                           // or your exact origin
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT"
};
const client = new DynamoDBClient({ region: "us-east-1" });

export async function handler(event) {
    // 1) scan catalog for product names…
    const scan = await client.send(new ScanCommand({
        TableName: "catalog",
        ProjectionExpression: "product"
    }));
    const names = (scan.Items || [])
        .map(i => i.product.S)
        .filter(Boolean);

    // 2) for each name, Query inventory for its quantity
    const available = await Promise.all(names.map(async name => {
        const q = await client.send(new QueryCommand({
            TableName: "inventory",
            KeyConditionExpression: "#p = :p",
            ExpressionAttributeNames: { "#p": "product" },
            ExpressionAttributeValues: { ":p": { S: name } },
            ProjectionExpression: "quantity"
        }));
        const qty = q.Items?.[0]?.quantity?.N;
        return qty && Number(qty) > 0 ? name : null;
    }));

    return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ available: available.filter(x => x) })
    };
}
