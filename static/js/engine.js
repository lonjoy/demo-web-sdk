$(function() {
	//私有变量
	var currentConversationTargetId = 0,
		conver, _historyMessagesCache = {},
		token = _html = "",
		namelist = {
			"group001": "融云群一",
			"group002": "融云群二",
			"group003": "融云群三",
			"kefu114": "客服"
		},
		audio = document.getElementsByTagName("audio")[0],
		//是否开启声音 
		hasSound = true,
		//登陆人员信息默认值
		owner = {
			id: "",
			portrait: "static/images/user_img.jpg",
			name: "张亚涛"
		},
		//初始化登陆人员信息
		list = location.search.slice(1).split('&'),
		$scope = {};
	var conversationStr = '<li targetType="{0}" targetId="{1}" targetName="{2}"><span class="user_img"><img src={3} onerror="this.src=\'static/images/personPhoto.png\'"/><font class="conversation_msg_num {4}">{5}</font></span><span class="conversationInfo"><p style="margin-top: 10px"><font class="user_name">{6}</font><font class="date" >{7}</font></p></span></li>';
	var historyStr = '<div class="xiaoxiti {0} user"><div class="user_img"><img onerror="this.src=\'static/images/personPhoto.png\'" src="{1}"/></div><span>{2}</span><div class="msg"><div class="msgArrow"><img src="static/images/{3}"> </div><span></span>{4}</div><div messageId="{5}" class="status"></div></div><div class="slice"></div>';
	var friendListStr = '<li targetType="4" targetId="{0}" targetName="{1}"><span class="user_img"><img src="static/images/personPhoto.png"/></span> <span class="user_name">{1}</span></li>';

	if (list.length == 3) {
		$.each(list, function(i, item) {
			var val = item.split("=");
			owner[val[0]] = decodeURIComponent(val[1]);
		});
		$("img[RCTarget='owner.portrait']").attr("src", owner.portrait);
		$('span[RCTarget="owner.name"]').html(owner.name);
	} else {
		location.href = "login.html";
		return;
	}
	//未读消息数
	$scope.totalunreadcount = 0;
	//绘画列表
	$scope.ConversationList = [];
	//好友列表
	$scope.friendsList = [];
	//会话标题
	$scope.conversationTitle = "";
	//开启关闭声音
	$("#closeVoice").click(function() {
		hasSound = !hasSound;
		this.innerHTML = hasSound ? "开启声音" : "关闭声音";
	});
	//退出
	$(".logOut>a,#close").click(function() {
		$.get("/logout?t=" + Date.now()).done(function(data) {
			if (RongIMClient.getInstance) RongIMClient.getInstance().disconnect();
		}).always(function(){
			location.href = "login.html";
		})
	});
	$.get("/friends?t=" + Date.now(), function(data) {
		if (data.code == 200) {
			$scope.friendsList = data.result;
			$scope.friendsList.forEach(function(item) {
				_html += String.stringFormat(friendListStr, item.id, item.username)
			});
			$("#friendsList").html(_html)
		}
	}, "json");

	$("#friendsList>li,#conversationlist>li").live("click", function() {
		if(this.parentNode.id=="conversationlist"){
			$("font.conversation_msg_num",this).hide().html("");
		}
		getHistory(this.getAttribute("targetId"), this.getAttribute("targetName"), this.getAttribute("targetType"));
	});
	$("div.listAddr li:lt(4)").click(function() {
		getHistory(this.getAttribute("targetId"), this.getAttribute("targetName"), this.getAttribute("targetType"));
	});
	$("#send").click(function() {
		if (!conver && !currentConversationTargetId) {
			alert("请选中需要聊天的人");
			return;
		}
		var con = $("#mainContent").val().replace(/\[.+?\]/g, function(x) {
			return RongIMClient.Expression.getEmojiObjByEnglishNameOrChineseName(x.slice(1, x.length - 1)).tag || x;
		});
		if (con == "") {
			alert("不允许发送空内容");
			return;
		}
		//发送消息
		var content = new RongIMClient.MessageContent(RongIMClient.TextMessage.obtain(myUtil.replaceSymbol(con)));
		RongIMClient.getInstance().sendMessage(conver.getConversationType(), currentConversationTargetId,content , null, {
			onSuccess: function() {
				console.log("send successfully");
			},
			onError: function(x) {
				$(".dialog_box div[messageId='" + content.getMessage().getMessageId() + "']").addClass("status_error");
				console.log(x.getValue(), x.getMessage())
			}
		});
		addhistoryMessages(content.getMessage());
		initConversationList();
		$("#mainContent").val("");
	});
	//初始化SDK
	RongIMClient.init("z3v5yqkbv8v30"); //e0x9wycfx7flq z3v5yqkbv8v30

	$.ajax({
		type: "get",
		url: "/token?t=" + Date.now(),
		dataType: "json"
	}).done(function(data) {
		if (data.code == 200) {
			token = data.result;
			//链接融云
			RongIMClient.connect(token.token, {
				onSuccess: function(x) {
					console.log("connected，userid＝" + x);
				},
				onError: function(c) {
					console.log("失败:" + c.getMessage())
				}
			});
		} else {
			alert("获取token失败,请重新登录");
			location.href = "login.html";
		}
	}).fail(function() {
		alert("获取token失败");
		location.href = "login.html";
	});

	//链接状态监听器
	RongIMClient.setConnectionStatusListener({
		onChanged: function(status) {
			console.log(status.getValue(), status.getMessage());
			if (status.getValue() == 0) {
				$scope.ConversationList = RongIMClient.getInstance().getConversationList();
				initConversationList();
			} else if (status.getValue() == 4) {
				location.href = "/WebIMDemo/login.html";
			}
		}
	});
	//接收消息监听器
	RongIMClient.getInstance().setOnReceiveMessageListener({
		onReceived: function(data) {
			if (hasSound) {
				audio.play();
			}
			$scope.totalunreadcount = RongIMClient.getInstance().getTotalUnreadCount();
			$("#totalunreadcount").show().html($scope.totalunreadcount);
			if (currentConversationTargetId != data.getTargetId()) {
				if (document.title != "[新消息]融云 Demo - Web SDK") document.title = "[新消息]融云 Demo - Web SDK";
				var person = $scope.friendsList.filter(function(item) {
					return item.id == data.getTargetId();
				})[0];
				var tempval = RongIMClient.getInstance().getConversation(data.getConversationType(), data.getTargetId());
				if (person) {
					tempval.setConversationTitle(person.username);
				} else {
					if (data.getTargetId() in namelist) {
						tempval.setConversationTitle(namelist[data.getTargetId()]);
					} else {
						RongIMClient.getInstance().getUserInfo(data.getTargetId(), {
							onSuccess: function(x) {
								tempval.setConversationTitle(x.getUserName());
							},
							onError: function() {
								tempval.setConversationTitle("陌生人Id：" + data.getTargetId());
							}
						});
					}
				}
				if (!_historyMessagesCache[data.getConversationType().getValue() + "_" + data.getTargetId()]) _historyMessagesCache[data.getConversationType().getValue() + "_" + data.getTargetId()] = [data];
				else _historyMessagesCache[data.getConversationType().getValue() + "_" + data.getTargetId()].push(data);
			} else {
				addhistoryMessages(data);
			}
			initConversationList(data);
		}
	});

	function addhistoryMessages(item) {
		$scope.historyMessages.push(item);
		$(".dialog_box:first").append(String.stringFormat(historyStr, item.getMessageDirection().getValue() == 0 ? "other_user" : "self", item.getMessageDirection().getValue() == 1 ? owner.portrait : "static/images/personPhoto.png", "", item.getMessageDirection().getValue() == 0 ? 'white_arrow.png' : 'blue_arrow.png', myUtil.msgType(item.getDetail()), item.getMessageId()));
	}

	function initConversationList() {
		_html = "";
		$scope.ConversationList.forEach(function(item) {
			_html += String.stringFormat(conversationStr, item.getConversationType().getValue(), item.getTargetId(), item.getConversationTitle(), "static/images/personPhoto.png", item.getUnreadMessageCount() == 0 ? "hidden" : "", item.getUnreadMessageCount(), item.getConversationTitle(), new Date(+item.getLatestTime()).toString().split(" ")[4]);
		});
		$("#conversationlist").html(_html);
	};
	//加载历史记录
	function getHistory(id, name, type) {
		if (!window.Modules) //检测websdk是否已经加载完毕
			return;
		currentConversationTargetId = id;
		$scope.conversationTitle = name;
		conver = RongIMClient.getInstance().createConversation(RongIMClient.ConversationType.setValue(type), currentConversationTargetId, name);
		if (!_historyMessagesCache[type + "_" + currentConversationTargetId]) _historyMessagesCache[type + "_" + currentConversationTargetId] = [];
		$scope.historyMessages = _historyMessagesCache[type + "_" + currentConversationTargetId];
		var tempval = $scope.ConversationList.filter(function(item) {
			return item.getTargetId() == currentConversationTargetId;
		})[0];
		if (tempval) {
			tempval.unread = 0;
			RongIMClient.getInstance().clearMessagesUnreadStatus(RongIMClient.ConversationType.setValue(type), currentConversationTargetId);
			$scope.totalunreadcount = RongIMClient.getInstance().getTotalUnreadCount();
			if ($scope.totalunreadcount <= 0) {
				document.title = "融云 Demo - Web SDK";
			}
		}
		$("#conversationTitle").html($scope.conversationTitle);
		_html = "";
		$scope.historyMessages.forEach(function(item, i) {
			_html += String.stringFormat(historyStr, item.getMessageDirection().getValue() == 0 ? "other_user" : "self", item.getMessageDirection().getValue() == 1 ? owner.portrait : "static/images/personPhoto.png", "", item.getMessageDirection().getValue() == 0 ? 'white_arrow.png' : 'blue_arrow.png', myUtil.msgType(item.getDetail()), item.getMessageId());
		});
		$(".dialog_box:first").html(_html);
		$("#totalunreadcount").html($scope.totalunreadcount);
		if ($scope.totalunreadcount == 0) {
			$("#totalunreadcount").hide();
		}
	}
});

String.stringFormat = function(str) {
	for (var i = 1; i < arguments.length; i++) {
		str = str.replace(new RegExp("\\{" + (i - 1) + "\\}", "g"), arguments[i] || "");
	}
	return str;
}
var myUtil = {
	msgType: function(type) {
		if ("imageUri" in type) {
			return String.stringFormat('<div class="msgBody">{0}</div>', "<img class='imgThumbnail' src='data:image/jpg;base64," + type.content + "' bigUrl='" + type.imageUri + "'/>");
		} else if ("duration" in type) {
			return String.stringFormat('<div class="msgBody voice">{0}</div>', "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;" + type.duration);
		} else if ("poi" in type) {
			return String.stringFormat('<div class="msgBody">{0}</div>{1}', "[位置消息]" + type.poi, "<img src='data:image/png;base64," + type.content + "'/>");
		} else {
			return String.stringFormat('<div class="msgBody">{0}</div>', this.initEmotion(this.symbolReplace(type.content)));
		}
	},
	initEmotion: function(str) {
		var a = document.createElement("span")
		return RongIMClient.Expression.retrievalEmoji(str, function(img) {
			a.appendChild(img.img);
			var str = '<span class="RongIMexpression_' + img.englishName + '">' + a.innerHTML + '</span>';
			a.innerHTML = "";
			return str;
		});
	},
	symbolReplace: function(str) {
		if (!str) return '';
		str = str.replace(/&/g, '&amp;');
		str = str.replace(/</g, '&lt;');
		str = str.replace(/>/g, '&gt;');
		str = str.replace(/"/g, '&quot;');
		str = str.replace(/'/g, '&#039;');
		return str;
	},
	replaceSymbol: function(str) {
		if (!str) return '';
		str = str.replace(/&amp;/g, '&');
		str = str.replace(/&lt;/g, '<');
		str = str.replace(/&gt;/g, '>');
		str = str.replace(/&quot;/g, '"');
		str = str.replace(/&#039;/g, "'");
		str = str.replace(/&nbsp;/g, " ");
		return str;
	}
};