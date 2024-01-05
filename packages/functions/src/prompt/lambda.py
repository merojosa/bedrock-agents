import boto3
import json
import uuid


# https://docs.aws.amazon.com/code-library/latest/ug/python_3_bedrock-agent-runtime_code_examples.html
def handler(event, context):
    print("Prompting...")
    bedrock_client = boto3.client(
        service_name="bedrock-agent-runtime",
        region_name="us-east-1",
    )

    body = json.loads(event['body'])
    input = body.get('input')
    agent_id = body.get("agentId")
    agent_alias_id = body.get("agentAliasId")
    session_id = body.get("sessionId")

    print(input)

    # https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/bedrock-agent-runtime/client/invoke_agent.html
    response_stream = bedrock_client.invoke_agent(
        inputText=input,
        endSession=False,
        enableTrace=False,
        agentId=agent_id,
        agentAliasId=agent_alias_id,
        sessionId=str(uuid.uuid4()) if session_id is None else session_id,
    )

    completion = ""

    for event in response_stream.get("completion"):
        chunk = event["chunk"]
        completion = completion + chunk["bytes"].decode()

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
        },
        "body": {
            "sessionId": response_stream["sessionId"],
            "text": completion
        },
    }
