var balda = {
	debug:true,
	letters:8,
	started:false,
	msg:{
		wrongtype:'Λάθος κίνηση',
		unknownWord: function(word){
			return 'Δεν ξέρω την λέξη "'+word+'"';
		},
		newLetter: 'Δεν έβαλες νέο γράμμα ',
		noWords:'Δεν έχω άλλες λέξεις ',
		turn: 'Σειρά σου να παίξεις',
		thinking:'Σκέφτομαι...',
		result: function(word){
			return 'Το βρήκα! "'+this.upper(word)+'"';
		},
		ingame: function(word){
			return 'Η λέξη "'+this.upper(word)+'" έχει γραφτεί!';
		},
		upper: function(word){
			return word.substr(0,1).toUpperCase()+word.substr(1,word.length);
		}
	},
		collection: {
			init: true,
			setRange: function(obj){
				var range = balda.cell.near(balda.alias(obj));
				this.range = [];
				for( var r = 0; r < range.length; r++){
					if(balda.alias(range[r]).hasClass('done')){
						this.range.push(balda.alias(range[r]));
					}
				}
			},
			added: function(obj){
				this.setRange(obj);
				obj.addClass('collected');
				this.answer[0].push(balda.cell.get(balda.alias(obj)));
				this.answer[1].push( balda.cell.val(balda.cell.get(balda.alias(obj))));
			},
			add:function(obj){
				var collected = obj.hasClass('collected');
				var clue = obj.hasClass('added');
				if(!collected){
					if(this.init){
						this.init = false;					
						this.added(obj);
					} else {
						var ranged = false;
						for(var r = 0; r<this.range.length; r++){
							if(obj.get(0) === this.range[r].get(0)){
								ranged = true;
							}
						}
						if(ranged){
							this.added(obj);
						} else {
							balda.status(balda.msg.wrongtype);
							balda.mode.set('letter');
						}
					}
					if(clue){
						this.correct = true;
					}
				} else {
					if(this.correct){
						var answer = this.answer[1].join('');
						var indic = false;
						for (var i = 0; i<dic.length; i++){
							if(dic[i] === answer){
								indic = true;
							}
						}
						if(indic){
							ingame = false;
							for(var n = 0; n < balda.ingame.length; n++){
								if(answer === balda.ingame[n]){
									ingame = true;
								}
							}
							if(!ingame){
								balda.status(balda.msg.thinking, true);
								for(a=0; a< this.answer.length; a++){
									balda.cell.fill(this.answer[0][a], this.answer[1][a], true);
								}
								this.correct = false;
								$('.added').removeClass('added');
								var answer = this.answer[1].join('')
								balda.ingame.push(answer);
								balda.stat.addWord('player', answer);
								balda.started = true;
								balda.turn();
							} else {
								balda.status(balda.msg.ingame(answer));
								balda.alias($('.added')).val('');
								balda.mode.set('letter');
							}
						} else {
							balda.status(balda.msg.unknownWord(answer));
							balda.alias($('.added')).val('');
							balda.mode.set('letter');
						}
					} else {
						balda.status(balda.msg.newLetter);	
						balda.alias($('.added')).val('');
						balda.mode.set('letter');
					}
				}
			}
		},
		stat:{
			count:0,
			answer: function(i){
				var out = '';
				for(a=0; a<this.answers.length; a++){
					if(i && this.answers[a].length>=i){
						out+=this.answers[a][0]+' '
					}
					if(!i){
						out+=this.answers[a][0]+' '
					}
				}
				console.log(out)
			},
			addWord: function(player, word){
				var score = $('.'+player+' .count').html();
				$('.'+player+' .words').append(word + '<span>(' + word.length + ')</span><br/>');
				$('.'+player+' .count').html(parseInt(score) + word.length )
			}
		},
		status: function(msg, endless){
			$('.status').html(msg);
			if(!endless){
				setTimeout(function(){$('.status').empty()}, 3000);
			}
			
		},
		mode: {
			set: function(m){
				this.state = m;
				$('.balda').removeClass().addClass('balda '+m);
				switch (m){
					case 'letter':
						$('.collected').removeClass('collected');
						balda.collection.answer = [[],[]];
						balda.collection.init = true;
						if($('.added').length){
							balda.alias($('.added')).val('')
							$('.added').html(' ').addClass('blank available').removeClass('done added');
						}
						window.clearInterval(this.hint);
						this.hint = setTimeout(function(){$('.give-up').fadeIn();}, 30000)
					break;
					case 'turn':
						$('.collected').removeClass('collected')
						window.clearInterval(this.hint);
						$('.give-up').hide();
					break;
				}
				
				
			},
			check: function(m){
				return (this.state == m);
			},
			state: 'letter'
		},
		ingame:[],
		variant: function(cell){
			this.stat.count++;
			window.clearInterval(this.wait);
			this.wait = setTimeout(balda_ready, 100);
			var snake =  cell[0];
			var val = cell[1];
			var head = snake[snake.length-1];
			if(val.length<=this.letters){
				var near = this.cell.near(this.cell.get(head));				
				for(var n = 0; n < near.length; n++){
					var v = this.cell.val(near[n]);
					var cellpos = this.cell.get(near[n]);
					var gotcha = true;
					var dotted = false;
					
					for(var s = 0; s<snake.length;s++){
						if(snake[s] == cellpos){
							gotcha = false;
						}
						if(val[s] == '.'){
							dotted = true;
						}
					}
					if(v){					
						if(gotcha){
							var snake2 = cell[0].concat([this.cell.get(near[n])]);
							var val2 = cell[1].concat([this.cell.val(near[n])]);
							var pos = [snake2, val2];
							if(dotted){
								this.vars.push(pos)
							} 
							this.variant(pos);
						}
					} else {
						var snake2 = cell[0].concat([this.cell.get(near[n])]);
						var val2 = cell[1].concat(['.']);
						var pos = [snake2, val2];
						if(!dotted){
							this.vars.push(pos);	
							this.variant(pos);
						} 
						
					}
				}
			}
		},
		show: function (){
			$('.justadded').removeClass('justadded');
			balda.log({name:balda.stat.count, timer:'start'});
			var reg = [];
			
			for(var i =0; i<this.vars.length; i++){
				reg.push([new RegExp('^'+this.vars[i][1].join('')+'$', "i"), this.vars[i][0], this.vars[i][1].length])
			}
			reg.sort(function(a,b){return b[2]-a[2];});
			//console.log(reg)
		
			answer = [];
			searching:
			for(r=0; r<reg.length; r++){
				var volume = this.dic['l'+reg[r][2]];
				subsearch:
				for(w in volume){
					if(reg[r][0].test(volume[w])){
						answer.push([volume[w], reg[r][1]]);
						break subsearch;
					}
				}
				
				/*for( var a = 0; a+1 < answer.length; a++ ){
					if(answer[a][0] == answer[a+1][0]){
						//delete answer[a];
						answer = answer.slice(0,a).concat( answer.slice(i+a) );
					}
				}*/
				
				//console.log(answer)			
				if(answer.length > this.ingame.length || r+1 == reg.length){
					balda.stat.answers = answer;	
					check:
					for(a=0; a<answer.length; a++){
						//console.log(answer[a][0]);
						var allow = true;
						for(g = 0; g< this.ingame.length; g++){
							if(answer[a][0] == this.ingame[g]){
								allow = false;
							}
						}
						if(allow){
							var word = answer[a][0];
							this.stat.addWord('pc', word);
							this.ingame.push(word);
							var fillword = word.split('');
							for (var l =0; l< fillword.length; l++){
								this.cell.fill(answer[a][1][l], fillword[l], true);
								chill(this.alias(this.cell.get(answer[a][1][l])));
							}
							this.status(this.msg.result(word));
							this.stat.single = word
							for ( var i = 0; i < this.field.length; i++ ){
								var obj = this.field[i];
								if(obj.val()){
									var near = this.cell.near(obj);
									for(var n = 0; n<near.length; n++){
										this.alias(near[n]).addClass('available');
									}
								}
							}
							break searching;
						} else {
							if(r+1 == reg.length){
								this.gameover(this.msg.noWords);
								break searching;
							} else {
								answer = [];
								balda.stat.answers = [];
								if(a<answer.length){
									continue searching;	
								} else {
									continue check;
								}
							}
							
						}
					} 
				}
			}
			balda.log(this.stat.single)
			balda.log({name:balda.stat.count, timer:'stop'});
			balda.mode.set('letter');
			if($('.blank').length == 0){
				this.gameover();
			} 	
		},
		cell: {
			get: function(id){
				if(typeof(id) == 'number'){
					return $('.balda input').eq(id);
				} else {
					if (typeof(id) == 'object' && id){
						return id.index('.balda input');
					} else {
						return null;
					}
				}
			},
			index: function(obj){
				return obj.index('input');
			},
			obj: function(i){
				return $('input').eq(i);
			},
			near: function(obj){
				var pos = this.get(obj);
				var near = [];
				if ( pos%5 !== 0 ) {
					near.push(this.get(pos-1));
				}
				if ( (pos+1)%5 !== 0 ) {
					near.push(this.get(pos+1));
				}
				if(pos<20){
					near.push(this.get(pos+5));
				}
				if(pos>4){
					near.push(this.get(pos-5));
				}
				return near;
			},
			val:function(id){
				if(typeof(id) == 'number'){
					return $('.balda input').eq(id).val();
				} else {
					if (typeof(id) == 'object'){
						return id.val();
					} else {
						return null;
					}
				}
			},
			fill:function(cell, val, first){
				var input = this.get(cell);
				input.val(val);
				balda.alias(input).removeClass().addClass('done').html(val);
				if(!first){
					balda.alias(input).addClass('added');
				}
			},
			blank: function(){
				
			}
		},
		alias: function(obj){
			if(obj.prop("tagName") == 'DIV'){
				return obj.siblings('input');
			} else if (obj.prop("tagName") == 'INPUT'){
				return obj.siblings('div');
			}
		},
		turn: function(){
			balda.mode.set('turn');
			this.stat.count = 0;
			if($('.blank').length == 0){
				balda.gameover()
			}
			this.field = [];
			$('.balda input').each(function(){
				balda.field.push($(this));
			});
			this.vars = [];
			balda.mode.set('letter')
			$('.available').removeClass('available');
			this.words = [];
			for ( var i = 0; i < this.field.length; i++ ){
				var obj = this.field[i];
				if(obj.val()){
					var pos = [[this.cell.get(obj)], [this.cell.val(obj)]];
					this.words.push(pos);
					var near = this.cell.near(obj);
					for(var n = 0; n<near.length; n++){
						if(!this.cell.val(near[n])){
							this.words.push([[this.cell.get(near[n])], ['.']]);
						}
						this.alias(near[n]).addClass('available')
					}
				}
			}
			if(this.started){
				
				for (var i = 0; i< this.words.length; i++){
					this.variant(this.words[i]);
				}	
			}
		},
		gameover: function(res){
			reason = res || '';
			$('.give-up').hide();
			var score = {
				player: $('.player .count').text(),
				pc: $('.pc .count').text()
			}
			if(score.player>score.pc){
				this.status(reason + 'Κέρδισες!', true);
			} else if (score.player < score.pc) {
				this.status(reason + 'Λυπάμαι, έχασες!', true);
			} else if (score.player == score.pc){
				this.status(reason + 'Ισοπαλία', true);
			}
			return false;
		},
		dic:{},
		init:function(){
			
			//dic.sort(function(a,b){return b.length - a.length});
			for (var i = 0; i<dic.length; i++){
				if(this.dic['l'+dic[i].length]){
					this.dic['l'+dic[i].length].push(dic[i])
				} else {
					this.dic['l'+dic[i].length] = [dic[i]]
				}
			}
			
			
			$('.balda div').addClass('blank');
			this.mode.set('letter');
			
			
			var first = this.dic.l5[Math.floor(Math.random()*this.dic.l5.length)].split('');
			//var first = 'ворон'.split('');
			this.ingame.push(first.join(''));
			balda.log('η πρώτη λέξη είναι:', first.join(''));
			var place = [10,11,12,13,14];
			for(var f=0; f<5; f++){
				this.cell.fill(place[f], first[f], true);
			}		
		
			
			
			//pat
			/*var ls = ' ткартсьмосилосадарапокор'.split('')
			for(p=1;p<=24;p++){
				this.cell.fill(p, ls[p], true);
			}
			this.ingame = ['мтс','гтк','ют','ют','ют','ют','тв','мтс','мтс','мтс','мтс','мтс','гтк','тит','тит','вт','вт','вт','вт','ти','ти','тв','паста','пасть','тетка']
			this.started = true;
			*///pat
			
		
		
			this.turn();
			this.status('Το παιχνίδι άρχισε...',true);
			
		},
		restart: function(){
			$('.count').html('0');
			$('.words, .status').empty();
			this.ingame = [];		
			this.started = false;
			$('.balda div').each(function(){
				$(this).html(' ');
				balda.alias($(this)).val('');
			}).removeClass();
			
			this.init();		
		},
		log: function(){
			if(this.debug){
				if(typeof(arguments[0]) == 'object'){
					var time = arguments[0];
					if(time.timer == 'start'){
						console.time(time.name);
					} else {
						console.timeEnd(time.name);
					}
				} else {
					var a = [];
					for (arg in arguments){
						a.push(arguments[arg])
					}
					console.log(a.join(' '));
				}
			}
		}
	}
	
	function chill(obj){
		obj.addClass('justadded');
		setTimeout(function(){obj.removeClass('justadded')}, 5000);
	}
	function balda_ready(){
		balda.show();
	}
	