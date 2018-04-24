<template>
  <div>
    <div id="picker">选择文件</div>
    <ul class="file-list">
      <li class="list" v-for="file in fileList">
        <span>{{file.name}}</span>
        <span>进度：{{file.percentage}}</span>
      </li>
    </ul>
  </div>
</template>

<!--<script src="../assets/lib/jquery2.0.0/jquery-2.0.0.js"></script>-->
<!--<script src="../assets/lib/webUploader/webuploader.js"></script>-->

<script type="text/ecmascript-6">
  // import '../assets/lib/jquery2.0.0/jquery-2.0.0.js';
  import WebUploader from 'webuploader';

  const request = {
    url_file_getUploadinfo: '/rsync/api/file/getUploadinfo',
    url_file_judgeFileChunkExisted: '/rsync/api/file/judgeFileChunkExisted',
    url_file_uploadChunks2Server: '/rsync/api/file/uploadChunks2Server',
    url_file_completeUpload2Server: '/rsync/api/file/completeUpload2Server',

    arg_file_getUploadinfo: {
      fileMd5: '',
      fileName: '',
      directoryId: '',
      fileSizeStr: '',
      projectId: '',
    },
    arg_file_judgeFileChunkExisted: {
      fileMd5: '',
      chunkMd5: '',
    },
    arg_file_uploadChunks2Server: {
      objectId: '',
      file: '',
      fileMd5: '',
      chunkMd5: '',
      chunkSizeStr: '',
      chunkIndexStr: '',
      fileName: '',
    },
    arg_file_completeUpload2Server: {
      objectId: '',
      fileName: '',
      fileSizeStr: '',
      fileMd5: '',
      directoryId: '',
      projectId: '',
      chunksCountStr: '',
    },

  };

  export default {
    name: 'HelloWorld',
    data() {
      return {
        options: {
          auto: true,
          url: request.url_file_uploadChunks2Server,
          button: '#picker',
          multiple: true,
          accept: '*',
          threads: 1,
          fileNumLimit: 3,
          formData: request.arg_file_uploadChunks2Server,
          chunked: true,
          chunkSize: 5 * 1024 * 1024,
          duplicate: true,
        },
        file: {},
        fileList: []
      }
    },
    mounted() {
      this.registerWebUpload();
      this.initWebUpload();
    },
    methods: {
      registerWebUpload() {
        const $this = this;
        WebUploader.Uploader.register({
          "before-send-file": "beforeSendFile",
          "before-send": "beforeSend",
          "after-send-file": "afterSendFile",
        }, {
          // 时间点1：所有分块进行上传之前调用此函数
          beforeSendFile: function (file) {
            const deferred = WebUploader.Deferred();
            const uploader = this;

            (new WebUploader.Uploader()).md5File(file)
              .then(md5 => {

                // 判断文件是否存在
                const getData = Object.assign({}, request.arg_file_getUploadinfo, {
                  fileMd5: md5,
                  fileName: file.name,
                  fileSizeStr: file.size.toString(),
                  directoryId: 58,
                  projectId: 58
                });
                $this.$post(request.url_file_getUploadinfo, getData)
                  .then(json => {
                    if (json.success && json.code === '200') {  // 文件不存在
                      $this.file = {
                        file,
                        fileMd5: md5,
                        fileName: file.name,
                        fileSizeStr: file.size.toString(),
                        objectId: json.data.objectId,
                        directoryId: 58,
                        projectId: 58
                      };
                      deferred.resolve();
                    } else if (json.success && json.code === '013') {  // 文件存在
                      file.setStatus('complete');
                      uploader.owner.skipFile(file);
                      deferred.resolve();
                    } else {
                      console.log(json.msg);
                      deferred.reject();
                    }
                  });
              });
            return deferred.promise();
          },
          // 时间点2：如果有分块上传，则每个分块上传之前调用此函数
          beforeSend: (block) => {
            const deferred = WebUploader.Deferred();
            const file = block.file;      // 获取分片所属的文件对象

            (new WebUploader.Uploader()).md5File(file, block.start, block.end)
              .then(md5 => {

                // 判断分块是否存在
                const getData = Object.assign({}, request.arg_file_judgeFileChunkExisted, {
                  fileMd5: this.file.fileMd5,
                  chunkMd5: md5,
                  objectId: this.file.objectId
                });
                this.$post(request.url_file_judgeFileChunkExisted, getData)
                  .then(json => {
                    this.file = Object.assign(this.file, {
                      // file,
                      chunkMd5: md5,
                      chunkSizeStr: file.size.toString(),
                      chunkIndexStr: block.chunk.toString()
                    });
                    this.uploader.options.formData = this.file;
                    if (json.success && json.code === '200') {
                      if (json.data.isExisted) {  // 块存在
                        deferred.reject();
                        this.file.file = '';
                      } else {
                        deferred.resolve();
                      }
                    } else {
                      console.log(json.msg);
                      // 上传失败，重新上传分块内容
                      // deferred.resolve();
                    }
                  });
              });

            return deferred.promise();
          },
          // 时间点3：上传完成
          afterSendFile: (file, ret) => {
            const deferred = WebUploader.Deferred();

            // 不是秒传，走完成接口
            if (this.file.fileMd5) {
              // 开始构造后台所需要的参数
              const getData = Object.assign({}, request.arg_file_completeUpload2Server, {
                objectId: this.file.objectId,
                fileName: this.file.fileName,
                fileSizeStr: this.file.fileSizeStr,
                fileMd5: this.file.fileMd5,
                directoryId: this.file.directoryId,
                projectId: this.file.projectId,
                chunksCountStr: Math.ceil(file.size / this.options.chunkSize)
              });
              this.$post(request.url_file_completeUpload2Server, getData)
                .then(json => {
                  if (json.success && json.code === '200') {
                    console.log('上传成功');
                    deferred.resolve();
                  } else {
                    console.log(json.msg);
                    deferred.reject();
                  }
                });
            } else {  // 秒传
              deferred.resolve();
            }

            return deferred.promise();
          }
        });
      },
      initWebUpload() {
        const options = this.options;
        const $this = this;

        this.uploader = WebUploader.create({
          auto: options.auto,
          swf: '../assets/lib/webuploader/Uploader.swf',
          // swf: '',
          server: options.url,
          // pick: {
          //   id: options.button,
          //   multiple: options.multiple,
          //   label: '选择文件'
          // },
          pick: options.button,
          accept: options.accept,
          threads: options.threads,
          fileNumLimit: options.fileNumLimit,
          formData: options.formData,
          chunked: options.chunked,
          chunkSize: options.chunkSize,
          chunkRetry: 1,
          duplicate: options.duplicate,
          prepareNextFile: false,
        });

        // 当有文件被添加进队列的时候，添加到页面预览
        this.uploader.on('fileQueued', (file) => {
          // this.$emit('fileChange', file);

          $this.fileList.push(file);
        });

        this.uploader.on('uploadStart', (file) => {
          // 在这里可以准备好formData的数据
          //this.uploader.options.formData.key = this.keyGenerator(file);
        });

        this.uploader.on('startUpload', (file) => {
          // 开始一次上传
          // this.fileList = [];
        });

        // 文件上传过程中创建进度条实时显示。
        this.uploader.on('uploadProgress', (file, percentage) => {
          // this.$emit('progress', file, percentage);
          console.log(file, percentage);
          $this.fileList.forEach((item, index) => {
            if (item.id === file.id) {
              item.percentage = percentage * 100;
              $this.fileList.splice(index, 1, item);
              return;
            }
          });
        });

        this.uploader.on('uploadSuccess', (file, response) => {
          // this.$emit('success', file, response);
          console.log(file, response);
          $this.fileList.forEach((item, index) => {
            if (item.id === file.id) {
              item.percentage = 100;
              $this.fileList.splice(index, 1, item);
              return;
            }
          });
        });

        this.uploader.on('uploadError', (file, reason) => {
          // console.error(reason);
          // this.$emit('uploadError', file, reason);
        });

        this.uploader.on('error', (type) => {
          let errorMessage = '';
          if (type === 'F_EXCEED_SIZE') {
            errorMessage = `文件大小不能超过${this.fileSingleSizeLimit / (1024 * 1000)}M`;
          } else if (type === 'Q_EXCEED_NUM_LIMIT') {
            errorMessage = '文件上传已达到最大上限数';
          } else {
            errorMessage = `上传出错！请检查后重新上传！错误代码${type}`;
          }

          console.error(errorMessage);
          // this.$emit('error', errorMessage);
        });

        this.uploader.on('uploadComplete', (file, response) => {

          // this.$emit('complete', file, response);
        });

        this.uploader.on('uploadFinished', () => {
          // 所有文件上传结束
          // 重置文件队列
          this.uploader.reset();
        });
      },
      upload(file) {
        this.uploader.upload(file);
      },
      stop(file) {
        this.uploader.stop(file);
      },
      // 取消并中断文件上传
      cancelFile(file) {
        this.uploader.cancelFile(file);
      },
      // 在队列中移除文件
      removeFile(file, bool) {
        this.uploader.removeFile(file, bool);
      },
      getAccept(accept) {
        switch (accept) {
          case 'text':
            return {
              title: 'Texts',
              exteensions: 'doc,docx,xls,xlsx,ppt,pptx,pdf,txt',
              mimeTypes: '.doc,docx,.xls,.xlsx,.ppt,.pptx,.pdf,.txt'
            };
            break;
          case 'video':
            return {
              title: 'Videos',
              exteensions: 'mp4',
              mimeTypes: '.mp4'
            };
            break;
          case 'image':
            return {
              title: 'Images',
              exteensions: 'gif,jpg,jpeg,bmp,png',
              mimeTypes: '.gif,.jpg,.jpeg,.bmp,.png'
            };
            break;
          default:
            return accept
        }
      },
    }
  }
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
  #picker {
    display: inline-block;
    width: 100px;
    padding: 7px 10px;
    border: 1px solid #0099CC;
    background: #0099CC;
    border-radius: 3px;
    color: #fff;
    font-size: 12px;
  }

  #picker input {
    display: none;
  }
</style>
