// 诊断 bootstrap：先跑探针，再加载真实 main.cjs
require('./zz-probe.cjs')
require('./main.cjs')