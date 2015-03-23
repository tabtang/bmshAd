/*
* @广告加载插件
* @百米生活 tangbo
* @流程原理：路由器在</body>之前插入m.js（非前端实现） ---> js获取m.js的参数，即gw_id  ---> 根据gw_id使用jsonp方式从后台获取广告代码 ---> innerHTML方式将广告代码插入到页面最底部 --> 执行html中的script（handler.js） ---> handler.js负责调整广告的位置、尺寸、轮播动画、关闭功能、及兼容性处理
*/
//全局变量
window.BMSHAD_Base = {};

;(function(BM){

	//配置
	BM.Config = {};
	
	//处理后的location.href
	var locaHref = (function(lh){
		lh = lh.replace(/(http:\/\/)|(https:\/\/)/,'').split('/')[0];
		return lh;
	})(location.href);
	
	/**
	 * 对象合并
	 */
	BM.extend = function(o,n,override){
		for(var p in n){
			if(n.hasOwnProperty(p) && (!o.hasOwnProperty(p) || override)){
				o[p]=n[p];
			}
		}
	};
	
	/**
	 * 获取js参数 -- ps:不要在方法中调用此方法，否则可能始终获取的是最后一个js的文件的参数，要在方法中使用，请先放到js加载时就会执行的变量中 保存,当 async 为 true时，该方法无效
	 * @return {Array} 返回js参数
	 */
	BM.getScriptArgs = function() {
		var scripts = document.getElementsByTagName('script'),
			script = scripts[scripts.length-1],//scripts[scripts.length-1],//因为当前dom加载时后面的script标签还未加载，所以最后一个就是当前的script
			src = script.src,
			reg = /(?:\?|&)(.*?)=(.*?)(?=&|$)/g,
			temp,
			res = {},
			data = {};
		while((temp=reg.exec(src))!=null)
			res[temp[1]] = decodeURIComponent(temp[2]);
		data.res = res;
		data.domainName = 'http://' + src.replace(/(http:\/\/)|(https:\/\/)/,'').split('/')[0] + '/';
		return data;
	};
	
	//保存路由器ID
	var scriptArgs = BM.getScriptArgs();
	BM.gw_id = scriptArgs.res.gw_id;
	
	//获取m.js的域名作为后续请求的URL
	BM.Config.baseURL = scriptArgs.domainName;
	BM.Config.dataURL = BM.Config.baseURL;
	
	//扩展函数BM
	BM.extend(BM, {
		whiteList: ['regexp:/100msh/'],
		//生成随机数UUID
		getUUID: (function(){
			var num = 0;
			return function(){
				return ('' + (Math.random()*10)+(num++)).replace(/\D/g,'');
			};
		})(),
		//重写appendChild 执行html字符串中的script
		append: function(ele, newEle){
			ele.appendChild(newEle);
			
			var scripts = newEle.getElementsByTagName('script'),
				_temporary,
				i = 0;
			for(; i<scripts.length; i++){
				_temporary = document.createElement('div');
				_temporary.appendChild(scripts[i].cloneNode(true));
				createScript(getScriptAttr(_temporary.innerHTML), scripts[i]);
				_temporary = null;
			}
			
			//获取script属性 返回 {key:val}
			function getScriptAttr(str){
				var   i = 0,
				   sreg = /(<script.*?>)([^<]*(?:(?!<\/script>)<[^<]*)*)(<\/script>)/gi,
					reg = /\s(.*?)=(.*?)(?=\s|>|$)/g,
					obj = {},
					temp;
				while((temp = reg.exec(str.replace(sreg, '$1').replace(/"|'/g,''))) != null){
					obj[temp[1]] = temp[2];
				}
				if(!/src=/.test(str.replace(sreg, '$1'))){ //无src属性的script
					obj['jscode'] = str.replace(sreg, '$2');
				}
				return obj;
			}
			//生成html中的script
			function createScript(obj, oldScript){
				var jsDom,
					key,
					parent = oldScript.parentNode;
				jsDom = document.createElement('script');
				//赋值属性
				for(key in obj){
					if(key != 'jscode'){
						jsDom[key] = obj[key];
					}
				}
				if(!obj.hasOwnProperty('src')){
					jsDom.text = obj['jscode'] || '';
				}
				parent.replaceChild(jsDom, oldScript);
			}
		},
		//比较白名单
		compareWhiteList: function(arr){
			//如果在白名单中 不加载广告
			//示例  ['www.baidu.com', 'regexp:/100msh/', 'function:function(lh){if(/hao123/.test(lh)){return true}}']
			/*
			白名单的三种配置方式：
			1、完整的域名(不包括http://和后面的参数)
			2、一个正则表达式(标识：regexp:)
			3、一个函数(标识：function:) (function要return true/false)  true 表示阻止广告
			*/
			var isShowAd = true; //是否显示广告
			for(var i=0; i<arr.length; i++){
				if(/^regexp:/.test(arr[i])){
					var reg = eval(arr[i].replace('regexp:', ''));
					if(typeof reg === 'object'){
						if(reg.test(locaHref)){
							isShowAd = false;
							break;	
						}
					}
				}else if(/^function:/.test(arr[i])){
					var fuc = eval('(' + arr[i].replace('function:', '') + ')');
					if(typeof fuc === 'function'){
						if(fuc(locaHref)){
							isShowAd = false;
							break;	
						}
					}
				}else{
					if(arr[i] === locaHref){
						isShowAd = false;
						break;	
					}
				}
			}
			return isShowAd;
		},
		//获取广告 (jsonp)
		getAd: function(res){
			var _script = document.createElement('script');
				_script.type = 'text/javascript';
				_script.src = BM.Config.dataURL + 'adretrieval/index?gw_id='+BM.gw_id+'&uuid='+ BM.getUUID() +'&callback=BMSHAD_Base.getAdHandle';
			document.getElementsByTagName('head')[0].appendChild(_script);
		},
		//获取广告后的处理
		getAdHandle: function(res){
			res = res || {};
			
			//如果在白名单(后台返回)中 不加载广告
			if(!BM.compareWhiteList(res.whiteList || [])){
				return false;
			}            
			
			if(res.status == 1){
				//写入广告
				var _div = document.createElement('div');
					_div.innerHTML = res.html;
				BM.append(document.body, _div);
			}else if(res.status == 2){
				//其他类型的广告(第三方)
				var _script = document.createElement('script');
					_script.type = 'text/javascript';
					_script.src = res.js_src;
				document.getElementsByTagName('head')[0].appendChild(_script);
			}
			
		}
	});
	
	//如果在iframe中 不加载广告
	if(top != self){
		return false;
	}
	
	//如果在白名单(固定)中 不加载广告
	if(!BM.compareWhiteList(BM.whiteList)){
		return false;
	}
	
	//获取广告
	BM.getAd();
	
})(BMSHAD_Base);