#!/bin/sh

cd $(dirname $0)

spacetime generate -o header-front/src/spacetime_bindings -l ts -p spacetime -y
