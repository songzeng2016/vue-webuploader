// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import Vue from 'vue'
import axios from 'axios'
import App from './App'
import router from './router'

import qs from 'qs'

Vue.config.productionTip = false

// axios 响应拦截器
axios.interceptors.response.use(function (response) {
  if (response.status === 200) {
    return response.data;
  } else {
    console.log('axios request error!');
  }
}, function (error) {
  // 打印错误信息
  console.log(error);
  return Promise.reject(error);
});

// axios.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded';

Vue.prototype.$http = axios;

Vue.prototype.$get = function (url, data = {}) {
  return axios.get(url, {
    params: data
  });
};
Vue.prototype.$post = function (url, data = {}) {
  // 处理请求参数，由 json 转为 字符串
  data = qs.stringify(data);
  return axios.post(url, data);
};

/* eslint-disable no-new */
new Vue({
  el: '#app',
  router,
  components: {App},
  template: '<App/>'
})
