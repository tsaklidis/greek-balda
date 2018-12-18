<?php
	$possibleNames = array(
		'Άλμπερτ Αϊνστάιν',
		'Μάρεϋ Μπούκτσιν',
		'Εμιλιάνο Ζαπάτα',
		'Φρόντο',
		'Χάρι Πότερ',
		'Αντώνης Σαμαράς',
		'Τσίπρας',
		'Πυθαγόρας',
		'Σωκράτης',
		'Ευκλείδης',
		'Πλάτων',
		'Ηρόδοτος',
		'Δημόκριτος',
	);
	$random_name= $possibleNames[rand(0, (count($possibleNames)-1) )];
	
?>
<!DOCTYPE HTML>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<title>Greek Balda</title>
<link href="css/reset.css" rel="stylesheet" type="text/css">
<link href="css/style.css" rel="stylesheet" type="text/css">
<script type="text/javascript" src="js/jquery-1.7.1.min.js"></script>
<script type="text/javascript" src="js/balda.js"></script>
<script type="text/javascript" src="js/dic.js"></script>
<script type="text/javascript">

	function letterize(obj){
			var letter=prompt('Γράψε το γράμμα σου','');
			if (letter) letter = letter.substr(0,1).toUpperCase(); 
			if (letter!=null && letter!="" && (/[Α-Ω]/.test(letter) ) ){
				balda.cell.fill(balda.cell.get(obj), letter);
				balda.mode.set('word');
			} else {
				balda.status('Γράφε μόνο με ελληνικούς κεφαλαίους χαρακτήρες')
			}
	}
	$(document).ready(function(){
		$('.balda div').click(function(){
			if(!balda.mode.check('turn')){
				var input = balda.alias($(this));
				var near = balda.cell.near(input);

				if(balda.mode.check('letter') && !$(this).hasClass('done')){
					var correct = false;
					for(var n=0; n<near.length; n++){
						if(balda.cell.val(near[n])){
							correct = true;
						}
					}
					if(correct){
						letterize(input)
					}
				} else if(balda.mode.check('word')){
					balda.collection.add($(this));
				}
			}
		});
		$('.give-up').click(function(){
			if(confirm('Σίγουρα θες να πας πάσο? ')){
				balda.status(balda.msg.thinking, true);
				balda.started = true;
				balda.turn();
			}
		});
		$('.again').click(function(){
			if(balda.started){
				if(!confirm('Πραγματικά θέλεις να αρχίσεις νέο παιχνίδι?')){
					return false;
				}
			}
			balda.restart();
		});

		balda.init();
	}).keydown(function(e){
		if(e.keyCode===27){
			balda.mode.set('letter');
		}
		if(e.keyCode==13 && balda.mode.check('word') && $('.added').length>0){
			$('.added').click();
		}
	});





</script>
</head>
<body>
<div class="balda-stat">
	<div class="status">Φτιάξε την λέξη</div>
	<div class="link">
		<em class="give-up">Πάσο</em>
		<em class="again">Νέο παιχνίδι</em>
	</div>
</div>
<div class="balda-container">
	<table class="balda">
		<tr>
			<td><div> </div>
				<input type="text" maxlength="1" value=""/></td>
			<td><div> </div>
				<input type="text" maxlength="1" value=""/></td>
			<td><div> </div>
				<input type="text" maxlength="1" value=""/></td>
			<td><div> </div>
				<input type="text" maxlength="1" value=""/></td>
			<td><div> </div>
				<input type="text" maxlength="1" value=""/></td>
		</tr>
		<tr>
			<td><div> </div>
				<input type="text" maxlength="1" value=""/></td>
			<td><div> </div>
				<input type="text" maxlength="1" value=""/></td>
			<td><div> </div>
				<input type="text" maxlength="1" value=""/></td>
			<td><div> </div>
				<input type="text" maxlength="1" value=""/></td>
			<td><div> </div>
				<input type="text" maxlength="1" value=""/></td>
		</tr>
		<tr>
			<td><div> </div>
				<input type="text" maxlength="1" value=""/></td>
			<td><div> </div>
				<input type="text" maxlength="1" value=""/></td>
			<td><div> </div>
				<input type="text" maxlength="1" value=""/></td>
			<td><div> </div>
				<input type="text" maxlength="1" value=""/></td>
			<td><div> </div>
				<input type="text" maxlength="1" value=""/></td>
		</tr>
		<tr>
			<td><div> </div>
				<input type="text" maxlength="1" value=""/></td>
			<td><div> </div>
				<input type="text" maxlength="1" value=""/></td>
			<td><div> </div>
				<input type="text" maxlength="1" value=""/></td>
			<td><div> </div>
				<input type="text" maxlength="1" value=""/></td>
			<td><div> </div>
				<input type="text" maxlength="1" value=""/></td>
		</tr>
		<tr>
			<td><div> </div>
				<input type="text" maxlength="1" value=""/></td>
			<td><div> </div>
				<input type="text" maxlength="1" value=""/></td>
			<td><div> </div>
				<input type="text" maxlength="1" value=""/></td>
			<td><div> </div>
				<input type="text" maxlength="1" value=""/></td>
			<td><div> </div>
				<input type="text" maxlength="1" value=""/></td>
		</tr>
	</table>
</div>
<div class="score-container">
	<div class="score clearfix">
		<div class="col player">
			<h2 id="username">
			<script type="text/javascript">
				var name=prompt('Πως σε λένε?','');

				document.getElementById("username").innerHTML = capitaliseFirstLetter(name);
				function capitaliseFirstLetter(string) { return string.charAt(0).toUpperCase() + string.slice(1); }
								
			</script>
			 <span>(<span class="count">0</span>)</span></h2>
			<div class="words"> </div>
		</div>
		<div class="col pc">
			<h2><?php echo $random_name; ?> <span> (<span class="count">0</span> ) </span> </h2>
			<div class="words"> </div>
		</div>
	</div>

</div>
</body>
</html>
