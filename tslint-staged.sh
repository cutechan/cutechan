#!/bin/sh

IFS='
'
exitcode=0
for file in `git diff --cached --name-only --diff-filter=ACM | grep '\.tsx\?$'`
do
    node_modules/.bin/tslint --fix "$file"
    if test $? -ne 0
    then
        exitcode=1
    fi
    git add "$file"
done
exit $exitcode
