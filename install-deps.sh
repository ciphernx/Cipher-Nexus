#!/bin/bash

# Install core dependencies
npm install @tensorflow/tfjs-node@4.17.0 \
           onnxruntime-node@1.17.0 \
           @pytorch/torch@2.2.0 \
           scikit-learn@0.24.2 \
           xgboost@1.7.0 \
           lightgbm@3.3.5 \
           lime-js@0.2.1 \
           shap@0.41.0 \
           worker-threads@1.0.0 \
           distributed-learning@1.0.0

# Install dev dependencies
npm install --save-dev @types/tensorflow__tfjs-node \
                     @types/onnxruntime-node \
                     @types/scikit-learn \
                     @types/xgboost \
                     @types/lightgbm 