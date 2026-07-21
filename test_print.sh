#!/bin/bash
export CLAUDE_CONFIG_DIR=/home/claude/.claude-healrise
/usr/bin/claude -p "echo test" > /opt/healrise/test_print.log 2>&1
