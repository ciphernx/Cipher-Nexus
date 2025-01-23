#!/bin/bash

# Exit on error
set -e

# Directory containing .proto files
PROTO_DIR="src/proto"

# Output directories for generated code
JS_OUT_DIR="src/generated"
TS_OUT_DIR="src/generated"

# Create output directories if they don't exist
mkdir -p "${JS_OUT_DIR}"
mkdir -p "${TS_OUT_DIR}"

# Find all .proto files
PROTO_FILES=$(find "${PROTO_DIR}" -name "*.proto")

# Generate JavaScript code
npx grpc_tools_node_protoc \
    --js_out=import_style=commonjs,binary:"${JS_OUT_DIR}" \
    --grpc_out=grpc_js:"${JS_OUT_DIR}" \
    --plugin=protoc-gen-grpc=`npx grpc_tools_node_protoc_plugin` \
    -I "${PROTO_DIR}" \
    ${PROTO_FILES}

# Generate TypeScript definitions
npx grpc_tools_node_protoc \
    --plugin=protoc-gen-ts=`npx protoc-gen-ts` \
    --ts_out=grpc_js:"${TS_OUT_DIR}" \
    -I "${PROTO_DIR}" \
    ${PROTO_FILES}

echo "Protocol Buffers code generation completed successfully" 